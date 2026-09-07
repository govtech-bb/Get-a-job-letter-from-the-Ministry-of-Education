/*
 * Add another. Enhances .govbb-add-another: the Add and Remove buttons stop
 * submitting the form and instead clone or drop an item on the page. A blank
 * template is taken from the first item at init (values and errors cleared).
 * Items are renumbered after every change: attributes written as templates
 * — data-name, data-id, data-for, data-describedby, data-controls,
 * data-labelledby, each holding a `%index%` placeholder — are copied to their
 * live counterparts, labels follow their inputs, and each legend reads
 * "<Item label> <n> of <count>". Remove buttons hide at data-min items
 * (default 1), the Add button at data-max. Focus moves to the new item, or to
 * the neighbour of a removed one, and a status region says what happened.
 * Modules inside a new item are enhanced via initAll. Fires
 * `govbb-add-another-add` and `govbb-add-another-remove` on the root.
 */
import { initAll } from '../../../index.js';

/** Template attribute → the live attribute it renumbers. */
const TEMPLATES = {
  'data-name': 'name',
  'data-id': 'id',
  'data-for': 'for',
  'data-describedby': 'aria-describedby',
  'data-controls': 'aria-controls',
  'data-labelledby': 'aria-labelledby',
};
const TEMPLATE_SELECTOR = Object.keys(TEMPLATES)
  .map((name) => `[${name}]`)
  .join(', ');

export class AddAnother {
  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.document = el.ownerDocument;
    this.items = el.querySelector('.govbb-add-another__items');
    this.addButton = el.querySelector('.govbb-add-another__add');
    const first = this.getItems()[0];
    if (!this.items || !this.addButton || !first) return;
    this.itemLabel = el.dataset.itemLabel || 'Item'; // empty counts as absent
    this.min = Math.max(1, Number(el.dataset.min) || 1);
    this.max = Number(el.dataset.max) || Infinity;

    // A blank copy of the first item to clone from.
    this.template = /** @type {HTMLElement} */ (first.cloneNode(true));
    this.reset(this.template);
    if (!this.template.querySelector('.govbb-add-another__remove')) {
      this.createRemoveButton(this.template);
    }

    this.status = this.document.createElement('div');
    this.status.className = 'govbb-visually-hidden';
    this.status.setAttribute('role', 'status');
    el.append(this.status);

    this.onClick = this.onClick.bind(this);
    el.addEventListener('click', this.onClick);
    this.update();
  }

  /** @returns {HTMLElement[]} */
  getItems() {
    return this.items
      ? Array.from(
          this.items.querySelectorAll(':scope > .govbb-add-another__item'),
        )
      : [];
  }

  /** Renumber every item, then size the buttons to the min/max. */
  update() {
    const items = this.getItems();
    const count = items.length;
    items.forEach((item, index) => {
      this.renumber(item, index);
      const legend = item.querySelector('.govbb-add-another__legend');
      if (legend) {
        legend.textContent =
          count > 1
            ? `${this.itemLabel} ${index + 1} of ${count}`
            : `${this.itemLabel} ${index + 1}`;
      }
      const remove =
        item.querySelector('.govbb-add-another__remove') ??
        this.createRemoveButton(item);
      remove.type = 'button';
      remove.textContent = `Remove ${this.itemLabel.toLocaleLowerCase()} ${index + 1}`;
      remove.hidden = count <= this.min;
    });
    this.addButton.type = 'button';
    this.addButton.hidden = count >= this.max;
  }

  /** Write `%index%` templates into the live attributes; labels follow ids. */
  renumber(item, index) {
    for (const element of item.querySelectorAll(TEMPLATE_SELECTOR)) {
      const previousId = element.id;
      for (const [template, attribute] of Object.entries(TEMPLATES)) {
        const value = element.getAttribute(template);
        if (value !== null) {
          element.setAttribute(
            attribute,
            value.replace(/%index%/g, String(index)),
          );
        }
      }
      if (previousId && element.id !== previousId) {
        for (const label of item.querySelectorAll(
          `label[for="${previousId}"]`,
        )) {
          label.htmlFor = element.id;
        }
      }
    }
  }

  /** Clear values and errors so a clone starts blank. */
  reset(item) {
    for (const field of item.querySelectorAll('input, select, textarea')) {
      if (field instanceof HTMLSelectElement) {
        for (const option of field.options) option.removeAttribute('selected');
        field.selectedIndex = -1;
      } else if (field instanceof HTMLTextAreaElement) {
        field.textContent = '';
        field.value = '';
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        field.removeAttribute('checked');
        field.checked = false;
      } else if (field.type !== 'hidden') {
        field.removeAttribute('value');
        field.value = '';
      }
      field.removeAttribute('aria-invalid');
    }
    // Drop error messages, and their ids (live and template) from whatever
    // described itself by them, so the clone does not point at nothing.
    for (const error of item.querySelectorAll('.govbb-error-message')) {
      const ids = [error.id, error.getAttribute('data-id')].filter(Boolean);
      for (const attribute of ['aria-describedby', 'data-describedby']) {
        for (const field of item.querySelectorAll(`[${attribute}]`)) {
          const rest = field
            .getAttribute(attribute)
            .split(/\s+/)
            .filter((id) => id && !ids.includes(id))
            .join(' ');
          if (rest) field.setAttribute(attribute, rest);
          else field.removeAttribute(attribute);
        }
      }
      error.remove();
    }
  }

  createRemoveButton(item) {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.className =
      'govbb-button govbb-button--text govbb-button--negative govbb-add-another__remove';
    (item.querySelector('.govbb-add-another__fieldset') ?? item).append(button);
    return button;
  }

  add() {
    const item = /** @type {HTMLElement} */ (this.template.cloneNode(true));
    this.items.append(item);
    this.update();
    initAll(item);
    const index = this.getItems().length - 1;
    this.announce(`${this.itemLabel} ${index + 1} added`);
    this.focus(item.querySelector('.govbb-add-another__fieldset'));
    this.el.dispatchEvent(
      new CustomEvent('govbb-add-another-add', {
        bubbles: true,
        detail: { item, index },
      }),
    );
  }

  /** @param {HTMLElement} item */
  remove(item) {
    const items = this.getItems();
    const index = items.indexOf(item);
    const neighbour = items[index - 1] ?? items[index + 1];
    item.remove();
    this.update();
    this.announce(`${this.itemLabel} ${index + 1} removed`);
    this.focus(
      neighbour?.querySelector('.govbb-add-another__fieldset') ??
        this.addButton,
    );
    this.el.dispatchEvent(
      new CustomEvent('govbb-add-another-remove', {
        bubbles: true,
        detail: { index },
      }),
    );
  }

  announce(message) {
    this.status.textContent = '';
    this.status.textContent = message;
  }

  focus(target) {
    if (!target) return;
    if (
      !target.hasAttribute('tabindex') &&
      !(target instanceof HTMLButtonElement)
    ) {
      target.tabIndex = -1;
    }
    target.focus();
  }

  /** @param {MouseEvent} event */
  onClick(event) {
    const button = /** @type {Element | null} */ (event.target)?.closest?.(
      '.govbb-add-another__add, .govbb-add-another__remove',
    );
    // Only this group's own buttons: a nested group's clicks bubble past us.
    if (!button || button.closest('.govbb-add-another') !== this.el) return;
    event.preventDefault();
    if (button.classList.contains('govbb-add-another__add')) {
      if (this.getItems().length < this.max) this.add();
      return;
    }
    const item = button.closest('.govbb-add-another__item');
    if (item && this.getItems().length > this.min) this.remove(item);
  }

  destroy() {
    if (!this.template) return;
    this.el.removeEventListener('click', this.onClick);
    this.status.remove();
  }
}
