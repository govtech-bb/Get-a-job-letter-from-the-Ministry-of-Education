/*
 * Number input steppers. Enhances .govbb-number-input-wrapper: clicking a
 * .govbb-number-input__step button steps the native input and emits a
 * bubbling change event so form code sees the update.
 */
export class NumberInput {
  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.input = el.querySelector('.govbb-number-input');
    this.incrementButton = el.querySelector(
      '.govbb-number-input__step:not(.govbb-number-input__step--down)',
    );
    this.decrementButton = el.querySelector('.govbb-number-input__step--down');
    this.onClick = this.onClick.bind(this);
    this.updateStepperState = this.updateStepperState.bind(this);
    el.addEventListener('click', this.onClick);
    this.input?.addEventListener('input', this.updateStepperState);
    this.updateStepperState();
  }

  updateStepperState() {
    const input = this.input;
    if (!input) return;
    const value = input.valueAsNumber;
    const min = input.min === '' ? Number.NaN : Number(input.min);
    const max = input.max === '' ? Number.NaN : Number(input.max);
    const unavailable = input.disabled || input.readOnly;

    if (this.incrementButton) {
      this.incrementButton.disabled =
        unavailable ||
        (Number.isFinite(value) && Number.isFinite(max) && value >= max);
    }
    if (this.decrementButton) {
      this.decrementButton.disabled =
        unavailable ||
        (Number.isFinite(value) && Number.isFinite(min) && value <= min);
    }
  }

  /** @param {MouseEvent} event */
  onClick(event) {
    // Use the element constructor from the component's own document. Elements
    // rendered in a docs-preview iframe are not instances of the parent
    // window's global Element constructor.
    const ElementClass = this.el.ownerDocument.defaultView?.Element;
    if (!ElementClass || !(event.target instanceof ElementClass)) return;
    const button = event.target.closest('.govbb-number-input__step');
    const input = this.input;
    if (!button || !input || input.disabled || input.readOnly) return;
    if (button.classList.contains('govbb-number-input__step--down')) {
      input.stepDown();
    } else {
      input.stepUp();
    }
    // both events, like a native stepper (and matching the React wrapper)
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  destroy() {
    this.el.removeEventListener('click', this.onClick);
    this.input?.removeEventListener('input', this.updateStepperState);
  }
}
