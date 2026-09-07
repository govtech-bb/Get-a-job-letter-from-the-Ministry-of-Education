/*
 * Combobox. Enhances a .govbb-combobox in one of two modes, decided by what it
 * wraps:
 *
 * - a native <select>: the select stays in the form (its name/value still
 *   submit) but is hidden, and a text input takes over its id — so the label
 *   now points at the input — along with its description, validity and
 *   required-ness. Typing filters the options, and the value is always one of
 *   them. Without JS the user gets the select.
 * - a text <input> with a <datalist>: the input keeps carrying the value (free
 *   text allowed) and the datalist's options are offered as suggestions —
 *   whatever the page puts there, unfiltered, so a lookup just rewrites the
 *   options as results arrive. Without JS the browser's own datalist popup
 *   applies.
 *
 * Both render the WAI-ARIA editable combobox pattern: focus stays in the input
 * and aria-activedescendant names the highlighted option. Choosing an option
 * fires input + change on the element carrying the value, then a bubbling
 * `govbb-combobox-select` CustomEvent (detail: index, value, label) on the
 * module root. Override the empty-list text with data-empty-label on the root.
 */

let instances = 0;

/** Case- and accent-insensitive key for matching ("Saint Lucía" ~ "lucia"). */
const fold = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();

/** Wiring the enhanced input copies from a wrapped select. */
const MIRRORED = [
  'aria-invalid',
  'aria-describedby',
  'aria-labelledby',
  'aria-label',
];

/** ARIA the enhancement puts on a wrapped input, undone by destroy(). */
const COMBOBOX_ATTRIBUTES = [
  'role',
  'aria-autocomplete',
  'aria-expanded',
  'aria-controls',
  'aria-activedescendant',
];

export class Combobox {
  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.document = el.ownerDocument;
    const doc = this.document;
    this.select = el.querySelector('select');
    const ownInput = this.select ? null : el.querySelector('input');
    this.source =
      this.select ?? ownInput?.list ?? el.querySelector('datalist') ?? null;
    if (!this.source || (!this.select && !ownInput)) return;
    this.emptyLabel = el.dataset.emptyLabel ?? 'No results found';
    /** @type {HTMLLIElement | null} the highlighted option */
    this.active = null;
    /** select mode: true while the input holds typed text, not a chosen label */
    this.filtered = false;
    /** free-text mode: true after a pick until the user types again, so
     *  suggestions recomputed for the picked value do not reopen the list */
    this.picked = false;
    /** true while choose() fires its own input event on the wrapped input */
    this.choosing = false;

    // Read the label while the wrapped control still owns the id.
    const control = this.select ?? ownInput;
    const label = control.labels?.[0];
    this.labelled = Boolean(label);

    let input;
    if (this.select) {
      const select = this.select;
      this.originalId = select.id;
      this.id = select.id || `govbb-combobox-${++instances}`;
      input = doc.createElement('input');
      input.className = 'govbb-input govbb-combobox__input';
      input.type = 'text';
      input.id = this.id;
    } else {
      input = ownInput;
      this.id = input.id || `govbb-combobox-${++instances}`;
      // The enhanced list replaces the browser's datalist popup and autofill.
      this.originalList = input.getAttribute('list');
      this.originalAutocomplete = input.getAttribute('autocomplete');
      input.removeAttribute('list');
    }
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', `${this.id}-listbox`);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    this.input = input;

    const list = doc.createElement('ul');
    list.className = 'govbb-combobox__list';
    list.id = `${this.id}-listbox`;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    if (label) {
      if (!label.id) label.id = `${this.id}-label`;
      list.setAttribute('aria-labelledby', label.id);
    }
    this.list = list;

    const status = doc.createElement('div');
    status.className = 'govbb-visually-hidden';
    status.setAttribute('role', 'status');
    this.status = status;

    if (this.select) {
      // Keep the select focusable (not display:none): the browser's own
      // required-field validation refuses to report on an unfocusable control.
      // The input sits first in tree order, so it is the one that gets reported.
      const select = this.select;
      select.id = `${this.id}-select`;
      select.setAttribute('aria-hidden', 'true');
      select.tabIndex = -1;
      select.classList.add('govbb-visually-hidden');
      select.before(input);
    }
    input.after(list, status);

    this.onInput = this.onInput.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onListPointerDown = this.onListPointerDown.bind(this);
    this.onListPointerMove = this.onListPointerMove.bind(this);
    this.onListClick = this.onListClick.bind(this);
    input.addEventListener('input', this.onInput);
    input.addEventListener('click', this.onClick);
    input.addEventListener('keydown', this.onKeydown);
    input.addEventListener('blur', this.onBlur);
    list.addEventListener('pointerdown', this.onListPointerDown);
    list.addEventListener('pointermove', this.onListPointerMove);
    list.addEventListener('click', this.onListClick);
    // Options can change under us — a lookup refilling the datalist, a
    // framework re-rendering the select — so follow them.
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(this.source, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    this.sync();
  }

  /**
   * Bring the enhancement up to date with the wrapped control: in select mode
   * mirror disabled, required, the aria-* wiring and — unless the user is
   * mid-typing — the chosen option's label onto the input; in both modes
   * re-render the list from the current options. The React wrappers call this
   * after every render; plain HTML consumers only need it after changing the
   * select or datalist programmatically without a DOM mutation.
   */
  sync() {
    const { select, input } = this;
    if (!this.source) return;
    if (select) {
      input.disabled = select.disabled;
      input.required = select.required;
      for (const name of MIRRORED) {
        const value = select.getAttribute(name);
        if (value === null) input.removeAttribute(name);
        else input.setAttribute(name, value);
      }
      if (this.list.hidden && !this.filtered) {
        input.value = this.chosen()?.label ?? '';
      }
    }
    if (!this.labelled) {
      // no <label>: name the listbox the way the control is named
      for (const name of ['aria-labelledby', 'aria-label']) {
        const value = (select ?? input).getAttribute(name);
        if (value === null) this.list.removeAttribute(name);
        else this.list.setAttribute(name, value);
      }
    }
    this.refresh();
  }

  /** Re-render after the options changed. Free-text mode also opens the list
   *  when suggestions arrive for text the user has typed, and closes it when
   *  there is nothing left to suggest. */
  refresh() {
    if (this.select) {
      if (!this.list.hidden) this.render();
      return;
    }
    const focused = this.document.activeElement === this.input;
    if (!focused || !this.options().length) {
      this.close();
    } else if (!this.list.hidden || (this.input.value !== '' && !this.picked)) {
      this.open();
    }
  }

  /** The wrapped control's <option> elements, in order. */
  options() {
    return Array.from(this.source.querySelectorAll('option'));
  }

  /** The option holding the current value: the selected one (ignoring an
   *  empty-value placeholder), or in free-text mode the one matching the text. */
  chosen() {
    const options = this.options();
    if (this.select) {
      const option = options[this.select.selectedIndex];
      return option && option.value !== '' ? option : null;
    }
    return options.find((option) => option.value === this.input.value) ?? null;
  }

  /** Bring the list in line with the current options — filtered by what the
   *  user typed in select mode, as supplied in free-text mode. The rows are
   *  only rebuilt when what they show actually changes: a consumer that
   *  re-renders while the list is open (a React form updating on every
   *  keystroke) would otherwise swap every row for an identical new node,
   *  detaching whatever the pointer, assistive tech or a test was holding.
   *  Returns false when there is nothing to show. */
  render() {
    const query = this.select && this.filtered ? fold(this.input.value) : '';
    const chosen = this.chosen();
    const activeIndex = this.active?.dataset.index;
    const rows = [];
    this.options().forEach((option, index) => {
      const label = option.label || option.value;
      // empty-value select options are placeholders ("Select a country")
      if (this.select && option.value === '') return;
      if (query && !fold(label).includes(query)) return;
      rows.push({
        index,
        label,
        disabled: Boolean(option.disabled),
        chosen: option === chosen,
      });
    });
    const count = rows.length;
    // nothing to suggest for free text; a select says so in the list
    if (!count && !this.select) return false;
    const signature = JSON.stringify(count ? rows : [this.emptyLabel]);
    if (this.list.dataset.signature === signature) return true;

    const items = rows.map((row) => {
      const item = this.document.createElement('li');
      item.className = 'govbb-combobox__option';
      item.id = `${this.id}-option-${row.index}`;
      item.dataset.index = String(row.index);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      if (row.disabled) item.setAttribute('aria-disabled', 'true');
      if (row.chosen) item.classList.add('govbb-combobox__option--chosen');
      item.textContent = row.label;
      return item;
    });
    if (!count) {
      const empty = this.document.createElement('li');
      empty.className = 'govbb-combobox__option govbb-combobox__option--empty';
      empty.setAttribute('role', 'option');
      empty.setAttribute('aria-disabled', 'true');
      empty.setAttribute('aria-selected', 'false');
      empty.textContent = this.emptyLabel;
      items.push(empty);
    }
    this.list.replaceChildren(...items);
    this.list.dataset.signature = signature;
    this.setActive(
      items.find(
        (item) =>
          item.dataset.index === activeIndex &&
          !item.hasAttribute('aria-disabled'),
      ) ?? null,
    );
    this.status.textContent = count
      ? `${count} ${count === 1 ? 'result' : 'results'} available`
      : this.emptyLabel;
    return true;
  }

  /** Options the user can move to and choose. */
  selectable() {
    return Array.from(
      this.list.querySelectorAll(
        '.govbb-combobox__option:not([aria-disabled="true"])',
      ),
    );
  }

  open() {
    if (!this.render()) {
      this.close();
      return;
    }
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (this.list.hidden) return;
    this.setActive(null);
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.status.textContent = '';
    // so reopening announces the count again rather than staying silent
    delete this.list.dataset.signature;
  }

  /** @param {HTMLLIElement | null} item */
  setActive(item) {
    this.active?.setAttribute('aria-selected', 'false');
    this.active = item;
    if (item) {
      item.setAttribute('aria-selected', 'true');
      this.input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView?.({ block: 'nearest' });
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  /** Select mode: select by option index (-1 clears), firing input + change
   *  on the select if it moved. */
  setValue(index) {
    const { select } = this;
    if (select.selectedIndex !== index) {
      select.selectedIndex = index;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.filtered = false;
    this.input.value = this.chosen()?.label ?? '';
  }

  /** @param {HTMLLIElement} item */
  choose(item) {
    const index = Number(item.dataset.index);
    const option = this.options()[index];
    this.close();
    if (!option) return;
    if (this.select) {
      this.setValue(index);
    } else {
      this.picked = true;
      this.choosing = true;
      this.input.value = option.value;
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
      this.choosing = false;
    }
    this.el.dispatchEvent(
      new CustomEvent('govbb-combobox-select', {
        bubbles: true,
        detail: {
          index,
          value: option.value,
          label: option.label || option.value,
        },
      }),
    );
  }

  /** Select mode: reconcile typed text with the options once the user is
   *  done. An exact label match is chosen, an emptied field clears the value,
   *  anything else reverts to the chosen label — the select never holds a
   *  non-option value. */
  commit() {
    const text = fold(this.input.value);
    const options = this.options();
    if (text === '') {
      // back to the placeholder option if there is one, else no selection
      this.setValue(options.findIndex((option) => option.value === ''));
      return;
    }
    const match = options.find(
      (option) =>
        option.value !== '' && !option.disabled && fold(option.label) === text,
    );
    this.setValue(match ? match.index : this.select.selectedIndex);
  }

  onInput() {
    if (this.choosing) return; // our own event from choose(), not typing
    // typing drops the highlight; a fresh list starts with nothing active
    this.setActive(null);
    this.picked = false;
    if (this.select) this.filtered = true;
    this.open();
  }

  onClick() {
    // Opening on click shows the whole list, so users who recognise an answer
    // more easily than they recall it can browse without typing first.
    if (this.list.hidden) this.open();
  }

  onBlur() {
    this.close();
    if (this.select) this.commit();
  }

  /** @param {KeyboardEvent} event */
  onKeydown(event) {
    const open = !this.list.hidden;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) this.open();
      const items = this.selectable();
      if (!items.length) return;
      const down = event.key === 'ArrowDown';
      let index;
      if (this.active) {
        index = items.indexOf(this.active) + (down ? 1 : -1);
      } else if (down) {
        // land on the current value when it is in view, else the first option
        index = Math.max(
          items.findIndex((item) =>
            item.classList.contains('govbb-combobox__option--chosen'),
          ),
          0,
        );
      } else {
        index = items.length - 1;
      }
      this.setActive(items[(index + items.length) % items.length]);
    } else if (event.key === 'Enter' && open) {
      if (this.active) {
        event.preventDefault();
        this.choose(this.active);
      } else if (this.select) {
        // never submit the form from an open list: settle the text instead
        event.preventDefault();
        this.close();
        this.commit();
      } else {
        this.close(); // free text: Enter submits, as on any input
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      this.close();
    }
  }

  /** @param {PointerEvent} event */
  onListPointerDown(event) {
    // keep focus (and the list) while the pointer is on an option or the
    // list's scrollbar; the click handler then chooses
    event.preventDefault();
  }

  /** @param {PointerEvent} event */
  onListPointerMove(event) {
    const item = optionFrom(event.target);
    if (item && item !== this.active) this.setActive(item);
  }

  /** @param {MouseEvent} event */
  onListClick(event) {
    const item = optionFrom(event.target);
    if (item) this.choose(item);
  }

  destroy() {
    const { select, input, list, status } = this;
    if (!this.source) return;
    this.observer.disconnect();
    input.removeEventListener('input', this.onInput);
    input.removeEventListener('click', this.onClick);
    input.removeEventListener('keydown', this.onKeydown);
    input.removeEventListener('blur', this.onBlur);
    list.removeEventListener('pointerdown', this.onListPointerDown);
    list.removeEventListener('pointermove', this.onListPointerMove);
    list.removeEventListener('click', this.onListClick);
    list.remove();
    status.remove();
    if (select) {
      input.remove();
      select.id = this.originalId;
      select.removeAttribute('aria-hidden');
      select.removeAttribute('tabindex');
      select.classList.remove('govbb-visually-hidden');
      return;
    }
    for (const name of COMBOBOX_ATTRIBUTES) input.removeAttribute(name);
    input.removeAttribute('autocapitalize');
    input.removeAttribute('spellcheck');
    for (const [name, value] of [
      ['list', this.originalList],
      ['autocomplete', this.originalAutocomplete],
    ]) {
      if (value === null) input.removeAttribute(name);
      else input.setAttribute(name, value);
    }
  }
}

/** The enabled option element under an event target, if any. */
function optionFrom(target) {
  const item = /** @type {Element | null} */ (target)?.closest?.(
    '.govbb-combobox__option:not([aria-disabled="true"])',
  );
  return item ?? null;
}
