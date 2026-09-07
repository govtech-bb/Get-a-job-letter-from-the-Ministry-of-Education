/*
 * Header menu toggle. Reveals the server-rendered [hidden] Menu control and
 * exposes state through data attributes. CSS collapses the navigation only at
 * mobile widths; desktop navigation remains visible. Without JS the toggle
 * stays hidden and the navigation stays open at every width.
 */
export class Header {
  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.toggle = el.querySelector('.govbb-header__toggle');
    this.nav = el.querySelector('.govbb-header__nav');
    if (!this.toggle || !this.nav) return;
    if (!this.nav.id) this.nav.id = 'govbb-header-nav';
    this.onClick = this.onClick.bind(this);
    this.toggle.setAttribute('aria-controls', this.nav.id);
    this.toggle.setAttribute('aria-expanded', 'false'); // start collapsed
    this.el.setAttribute('data-govbb-header-enhanced', '');
    this.nav.setAttribute('data-expanded', 'false');
    this.toggle.removeAttribute('hidden');
    this.nav.removeAttribute('hidden');
    this.toggle.addEventListener('click', this.onClick);
  }

  onClick() {
    const expanded = this.toggle.getAttribute('aria-expanded') === 'true';
    this.toggle.setAttribute('aria-expanded', String(!expanded));
    this.nav.setAttribute('data-expanded', String(!expanded));
  }

  destroy() {
    if (!this.toggle || !this.nav) return;
    this.toggle.removeEventListener('click', this.onClick);
    // back to the no-JS baseline: hidden toggle, open panel
    this.toggle.removeAttribute('aria-expanded');
    this.toggle.setAttribute('hidden', '');
    this.el.removeAttribute('data-govbb-header-enhanced');
    this.nav.removeAttribute('data-expanded');
    this.nav.removeAttribute('hidden');
  }
}
