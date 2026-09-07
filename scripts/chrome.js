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

// data-govbb-module="header" is what initAll() looks for. Without it the
// header renders but never enhances, which is invisible in review.
export const header = `
<header class="govbb-header" data-govbb-module="header">
  <div class="govbb-width-container govbb-header__inner">
    <a class="govbb-header__home" href="{{base}}index.html">
      <img class="govbb-header__logo" src="{{base}}assets/images/govbb-logo.svg" alt="Government of Barbados" />
    </a>
    <span class="govbb-text-h4">Job letters</span>
  </div>
</header>`;

export const alphaBanner = `
<div class="govbb-status-banner govbb-status-banner--alpha govbb-status-banner--full-width">
  <div class="govbb-width-container govbb-status-banner__inner">
    <p>
      <strong>Alpha</strong> — this is a new service. Help us improve it by
      <a class="govbb-link" href="{{base}}contact.html">letting us know what you think</a>.
    </p>
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

// Shown where a feature genuinely cannot work server-side. The design system
// is explicit that this is not a blanket gate: "most pages should still
// function", and on this service they do — only the record lookup and the
// verification check need script, because GitHub Pages has no server to post
// to. Copy follows /templates/javascript-disabled/.
export function noScript(what) {
  return `
      <noscript>
        <div class="govbb-status-banner govbb-status-banner--alpha">
          <h2 class="govbb-text-h3">${what} needs JavaScript to work</h2>
          <p>JavaScript is turned off in your browser, or your browser does not support it.</p>
          <ul class="govbb-list govbb-list--bullet">
            <li>Turn on JavaScript in your browser settings, then refresh this page.</li>
            <li>Try an up-to-date browser — Chrome, Safari, Firefox and Edge all support it by default.</li>
          </ul>
          <p>
            If you cannot use JavaScript,
            <a class="govbb-link" href="{{base}}contact.html">contact us</a>
            and we will help you another way.
          </p>
        </div>
      </noscript>`;
}
