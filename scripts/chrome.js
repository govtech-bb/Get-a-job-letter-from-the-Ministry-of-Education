// The shared page chrome — skip link, official banner, header, alpha banner,
// footer — as markup copied from the design system's component pages.
//
// This used to be injected at runtime by chrome.js, which meant a page with
// JavaScript unavailable had no header, no footer and no skip link. It is now
// rendered into each HTML file by scripts/build-pages.js, so the chrome is
// present in the served source and script only enhances it.
//
// Sources (canonical markup copied from each component's page):
//   /components/skip-link/  /components/official-banner/  /components/header/
//   /components/status-banner/  /components/footer/  /components/breadcrumbs/

// Paths are root-relative. The site is served from the domain root on Vercel
// and from a project subpath on GitHub Pages, so the build script rewrites
// these per page — see toPagePath in build-pages.js.
export const skipLink = `
<a class="govbb-skip-link" href="#main-content">Skip to main content</a>`;

export const officialBanner = `
<div class="govbb-official-banner">
  <div class="govbb-width-container govbb-official-banner__inner">
    <div class="govbb-official-banner__crest">
      <img class="govbb-official-banner__icon" src="{{base}}assets/images/govbb-crest.svg" alt="" />
    </div>
    <div class="govbb-official-banner__text">
      <span>Official government website</span>
    </div>
  </div>
</div>`;

// The platform header, matching what alpha.gov.bb serves, so someone landing
// in this service can get back out to the rest of gov.bb.
//
// data-govbb-module="header" is what initAll() looks for, but the module bails
// out unless it finds BOTH .govbb-header__toggle and .govbb-header__nav:
//
//     if (!this.toggle || !this.nav) return;
//
// so the previous logo-only header was enhanced by nothing at all while still
// reporting "1 of 1 processed". The toggle ships `hidden` on purpose — the
// module removes it, and with no JavaScript the toggle stays hidden and the
// nav stays open at every width, which is the no-JS baseline the component
// documents. aria-expanded and aria-controls are set by the module, not here.
//
// The logo points at the platform homepage, as it does on alpha.gov.bb; this
// service's own home stays reachable through the breadcrumbs. No aria-current
// on it, because unlike the live site this is never the current page.
export const header = `
<header class="govbb-header" data-govbb-module="header">
  <div class="govbb-width-container govbb-header__inner">
    <a class="govbb-header__home" href="https://alpha.gov.bb/">
      <img class="govbb-header__logo" src="{{base}}assets/images/govbb-logo.svg" alt="Go to the alpha.gov.bb homepage" />
    </a>
    <div class="govbb-header__controls">
      <button class="govbb-button govbb-button--ghost govbb-header__toggle" type="button" hidden>Menu</button>
    </div>
    <nav id="govbb-header-nav" class="govbb-header__nav" aria-label="Primary navigation">
      <div class="govbb-header__nav-inner">
        <a class="govbb-link govbb-link--no-visited" href="https://alpha.gov.bb/services">Services</a>
        <a class="govbb-link govbb-link--no-visited" href="https://tracking.alpha.gov.bb">Track my application</a>
        <a class="govbb-button" href="https://chat.alpha.gov.bb">Ask Assistant</a>
      </div>
    </nav>
  </div>
</header>`;

// Copy matches what alpha.gov.bb serves, so a service on the platform says the
// same thing about its phase as the platform does. The link is absolute because
// this service is not hosted on that domain, so the relative /what-we-mean-by-alpha
// the live site uses would 404 here.
export const alphaBanner = `
<div class="govbb-status-banner govbb-status-banner--alpha govbb-status-banner--full-width">
  <div class="govbb-width-container govbb-status-banner__inner">
    <p>This page is in <a class="govbb-link" href="https://alpha.gov.bb/what-we-mean-by-alpha">Alpha</a>.</p>
  </div>
</div>`;

export const footer = `
<footer class="govbb-footer">
  <div class="govbb-width-container govbb-footer__inner">
    <nav class="govbb-footer__nav" aria-label="Footer navigation">
      <ul class="govbb-footer__list">
        <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="{{base}}cookies.html">Cookies</a></li>
        <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="{{base}}privacy.html">Privacy notice</a></li>
        <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="{{base}}accessibility.html">Accessibility statement</a></li>
        <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="{{base}}contact.html">Contact us</a></li>
        <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="{{base}}terms.html">Terms of use</a></li>
      </ul>
    </nav>
    <hr class="govbb-footer__divider" aria-hidden="true" />
    <div class="govbb-footer__end">
      <img class="govbb-footer__coat" src="{{base}}assets/images/govbb-crest.svg" alt="" />
      <p class="govbb-footer__copy">
        Built by GovTech Barbados with the Ministry of Education Transformation.
        All content is available under the Open Government Licence except where otherwise stated.
      </p>
    </div>
  </div>
</footer>`;

// The design system is explicit that the trail "does not include the current
// page: start with the homepage and end with the parent of the current page",
// so the last entry each page declares is dropped.
export function breadcrumbs(items) {
  const trail = items.slice(0, -1);
  if (!trail.length) return "";

  const crumbs = trail
    .map(
      (b) =>
        `        <li class="govbb-breadcrumbs__item">` +
        `<a class="govbb-link govbb-breadcrumbs__link" href="{{base}}${b.href}">${b.label}</a></li>`
    )
    .join("\n");

  return `
      <nav class="govbb-breadcrumbs govbb-breadcrumbs--collapse-on-mobile" aria-label="Breadcrumb">
        <ol class="govbb-breadcrumbs__list">
${crumbs}
        </ol>
      </nav>`;
}

// One initAll() for the whole document, after it exists. type="module" defers
// by default, so the DOM is ready by the time this runs.
export const runtime = `
<script type="module">
  // The "./" matters: a bare "assets/…" specifier is treated as a package name
  // and fails to resolve, leaving every behavioural component inert.
  import { initAll } from "./{{base}}assets/govbb/index.js";
  initAll();
</script>`;

// Shown where a feature may not work without script. The design system is
// explicit that this is not a blanket gate: "most pages should still
// function", and on this service they do. Copy follows
// /templates/javascript-disabled/.
//
// Two shapes, because the two pages differ. verify.html genuinely cannot check
// a letter without script anywhere. request.html submits fine without script
// wherever the API is served — but the GitHub Pages demo has no server to
// process the POST, and the same HTML is served to both, so the wording has to
// be true either way: it says what to do if it does not work, rather than
// asserting that it will not.
const NOSCRIPT_COPY = {
  "Checking a letter": {
    heading: "Checking a letter needs JavaScript to work",
    lead: "JavaScript is turned off in your browser, or your browser does not support it.",
  },
  "Requesting a letter": {
    heading: "You may not be able to request a letter without JavaScript",
    lead:
      "This form works without JavaScript on the main service, but not on every copy of it. " +
      "If selecting Continue does not take you to a confirmation page, use one of the options below.",
  },
};

export function noScript(what) {
  const copy = NOSCRIPT_COPY[what] || {
    heading: `${what} needs JavaScript to work`,
    lead: "JavaScript is turned off in your browser, or your browser does not support it.",
  };

  return `
      <noscript>
        <div class="govbb-status-banner govbb-status-banner--alpha">
          <h2 class="govbb-text-h3">${copy.heading}</h2>
          <p>${copy.lead}</p>
          <ul class="govbb-list govbb-list--bullet">
            <li>Turn on JavaScript in your browser settings, then refresh this page.</li>
            <li>Try an up-to-date browser. Chrome, Safari, Firefox and Edge all support it by default.</li>
          </ul>
          <p>
            If you cannot use JavaScript,
            <a class="govbb-link" href="{{base}}contact.html">contact us</a>
            and we will help you another way.
          </p>
        </div>
      </noscript>`;
}
