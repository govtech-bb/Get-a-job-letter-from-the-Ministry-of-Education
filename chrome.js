// Injects the shared chrome (official banner, header, alpha banner, footer)
// around the page's <main>. Keeps each page file slim.
//
// Pages should include:
//   <body class="govbb-page">
//     <main id="main-content" class="page-main">...</main>
//   </body>
// and set <html data-page-title="..."> for the page heading.

(function () {
  const officialBanner = `
    <div class="govbb-official-banner">
      <div class="govbb-container">
        <div class="govbb-official-banner__inner">
          <span class="govbb-official-banner__crest">
            <img class="govbb-official-banner__icon" src="assets/images/govbb-creast.svg" alt="" aria-hidden="true" />
          </span>
          <div class="govbb-official-banner__text">
            <span>An official service of the Government of Barbados</span>
          </div>
        </div>
      </div>
    </div>`;

  const header = `
    <header class="govbb-header">
      <div class="govbb-container">
        <div class="govbb-header__inner">
          <a href="index.html" aria-label="Ministry of Education job letters — home">
            <img class="govbb-header__logo" src="assets/images/govbb-logo.svg" alt="Government of Barbados" />
          </a>
          <span class="govbb-text-h4">Job letters</span>
        </div>
      </div>
    </header>`;

  const alphaBanner = `
    <div class="govbb-status-banner govbb-status-banner--alpha">
      <div class="govbb-container">
        <p>
          <strong>Alpha</strong> — this is a new service. Help us improve it
          by <a class="govbb-link" href="contact.html">letting us know what you think</a>.
        </p>
      </div>
    </div>`;

  // Service-style footer — standard order, following the GOV.UK pattern.
  // No "View source" link here; that's a developer concern, not a citizen one.
  const footer = `
    <footer class="govbb-footer">
      <div class="govbb-container">
        <div class="govbb-footer__inner">
          <nav class="govbb-footer__nav" aria-label="Footer">
            <a class="govbb-footer__link" href="cookies.html">Cookies</a>
            <a class="govbb-footer__link" href="privacy.html">Privacy notice</a>
            <a class="govbb-footer__link" href="accessibility.html">Accessibility statement</a>
            <a class="govbb-footer__link" href="contact.html">Contact us</a>
            <a class="govbb-footer__link" href="terms.html">Terms of use</a>
          </nav>
          <hr class="govbb-footer__divider" />
          <div class="govbb-footer__end">
            <img class="govbb-footer__coat" src="assets/images/govbb-creast.svg" alt="" aria-hidden="true" />
            <p class="govbb-footer__copy">
              Built by GovTech Barbados with the Ministry of Education Transformation.
              All content is available under the Open Government Licence except where otherwise stated.
            </p>
          </div>
        </div>
      </div>
    </footer>`;

  const skipLink = `<a class="govbb-visually-hidden govbb-visually-hidden-focusable" href="#main-content">Skip to main content</a>`;

  function render() {
    const body = document.body;
    const main = document.getElementById("main-content");
    if (!main) return;

    // Wrap the main's existing children in a container, preserving node identity
    // (so any pre-attached event listeners on inner elements still work).
    if (!main.querySelector(":scope > .govbb-container")) {
      const breadcrumbs = main.dataset.breadcrumbs;
      const container = document.createElement("div");
      container.className = "govbb-container";

      if (breadcrumbs) {
        const tmp = document.createElement("div");
        tmp.innerHTML = renderBreadcrumbs(JSON.parse(breadcrumbs));
        container.appendChild(tmp.firstElementChild);
      }

      const column = document.createElement("div");
      column.className = "content-column stack-lg";
      while (main.firstChild) column.appendChild(main.firstChild);
      container.appendChild(column);
      main.appendChild(container);
    }

    // Insert chrome before/after main.
    body.insertAdjacentHTML("afterbegin", skipLink + officialBanner + header + alphaBanner);
    body.insertAdjacentHTML("beforeend", footer);
  }

  function renderBreadcrumbs(items) {
    return `<nav class="govbb-breadcrumbs govbb-breadcrumbs--collapse-on-mobile" aria-label="Breadcrumb">
      <ol class="govbb-breadcrumbs__list">
        ${items.map((b, i) => `<li class="govbb-breadcrumbs__item">${
          i === items.length - 1
            ? `<span aria-current="page">${b.label}</span>`
            : `<a class="govbb-breadcrumbs__link" href="${b.href}">${b.label}</a>`
        }</li>`).join("")}
      </ol>
    </nav>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
