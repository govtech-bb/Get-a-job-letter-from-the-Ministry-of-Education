/*
 * File upload chosen-file list. Enhances .govbb-file-upload: mirrors the
 * input's FileList into .govbb-file-upload__list with a Remove button per
 * file. Override the button text with data-remove-label on the module root.
 */
export class FileUpload {
  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.document = el.ownerDocument;
    this.input = el.querySelector('input[type="file"]');
    this.list = el.querySelector('.govbb-file-upload__list');
    if (!this.list) {
      this.list = this.document.createElement('ul');
      this.list.className = 'govbb-file-upload__list';
      el.append(this.list);
    }
    this.removeLabel = el.dataset.removeLabel ?? 'Remove';
    this.status = this.document.createElement('span');
    this.status.className = 'govbb-visually-hidden';
    this.status.setAttribute('role', 'status');
    el.append(this.status);
    this.onChange = this.render.bind(this);
    this.onClick = this.onClick.bind(this);
    this.input?.addEventListener('change', this.onChange);
    this.list.addEventListener('click', this.onClick);
    this.render();
  }

  render() {
    const items = Array.from(this.input?.files ?? [], (file, index) => {
      const item = this.document.createElement('li');
      item.className = 'govbb-file-upload__item';
      const name = this.document.createElement('span');
      name.className = 'govbb-file-upload__name';
      name.textContent = file.name;
      name.title = file.name; // the CSS clips it; hover gets the whole name
      const remove = this.document.createElement('button');
      remove.className =
        'govbb-button govbb-button--text govbb-button--negative';
      remove.type = 'button';
      remove.dataset.index = String(index);
      remove.textContent = this.removeLabel;
      // distinguish the buttons for screen readers ("Remove passport.pdf")
      remove.setAttribute('aria-label', `${this.removeLabel} ${file.name}`);
      item.append(name, remove);
      return item;
    });
    this.list.replaceChildren(...items);
  }

  /** @param {MouseEvent} event */
  onClick(event) {
    const view = this.document.defaultView;
    const ElementClass = view?.Element;
    if (!ElementClass || !(event.target instanceof ElementClass)) return;
    const button = event.target.closest('button[data-index]');
    if (!button || !this.input) return;
    const index = Number(button.dataset.index);
    const removed = this.input.files?.[index]?.name;
    const DataTransferClass = view.DataTransfer ?? globalThis.DataTransfer;
    const transfer = new DataTransferClass();
    for (const [i, file] of Array.from(this.input.files ?? []).entries()) {
      if (i !== index) transfer.items.add(file);
    }
    this.input.files = transfer.files;
    // our own change listener re-renders the list
    this.input.dispatchEvent(new view.Event('change', { bubbles: true }));
    this.input.focus();
    if (removed != null) this.status.textContent = `${removed} removed`;
  }

  destroy() {
    this.input?.removeEventListener('change', this.onChange);
    this.list.removeEventListener('click', this.onClick);
    this.status.remove();
  }
}
