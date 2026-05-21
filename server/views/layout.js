// Shared page layout. Uses the govbb design system classes already compiled
// into dist/styles.css. Pages built so they work without JavaScript.

export function layout({ title, main, breadcrumbs = null, banner = "alpha" }) {
  const breadcrumbsHtml = breadcrumbs
    ? `<nav class="govbb-breadcrumbs govbb-breadcrumbs--collapse-on-mobile" aria-label="Breadcrumb">
         <ol class="govbb-breadcrumbs__list">
           ${breadcrumbs
             .map(
               (b, i) =>
                 `<li class="govbb-breadcrumbs__item">${
                   i === breadcrumbs.length - 1
                     ? `<span aria-current="page">${escapeHtml(b.label)}</span>`
                     : `<a class="govbb-breadcrumbs__link" href="${b.href}">${escapeHtml(b.label)}</a>`
                 }</li>`
             )
             .join("")}
         </ol>
       </nav>`
    : "";

  const bannerHtml = banner
    ? `<div class="govbb-status-banner govbb-status-banner--${banner}">
         <div class="govbb-container">
           <p><strong>Alpha</strong> — this is a new service, built against synthetic data. Your feedback will help us improve it.</p>
         </div>
       </div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Job letters — Ministry of Education</title>
  <meta name="description" content="Request a job letter from the Ministry of Education Transformation." />
  <link rel="icon" href="/assets/images/favicon.ico" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    /* Page-level conveniences. Component styles live in the govbb design system. */
    .page-main { padding-block: var(--spacing-m); }
    .content-column { max-width: 44rem; }
    .stack > * + * { margin-top: var(--spacing-s); }
    .stack-lg > * + * { margin-top: var(--spacing-m); }
    .panel-success {
      background: var(--color-green-10);
      border-left: 8px solid var(--color-green-00);
      padding: var(--spacing-m);
    }
    .panel-warning {
      background: var(--color-yellow-40);
      border-left: 8px solid var(--color-yellow-00);
      padding: var(--spacing-m);
    }
    .panel-error {
      background: var(--color-red-10);
      border-left: 8px solid var(--color-red-00);
      padding: var(--spacing-m);
    }
    .panel-info {
      background: var(--color-blue-10);
      border-left: 8px solid var(--color-blue-100);
      padding: var(--spacing-m);
    }
    .key-value { display: grid; gap: var(--spacing-xs); }
    .key-value dt { color: var(--color-text-muted); font-size: var(--font-size-caption); }
    .key-value dd { margin: 0; font-weight: var(--font-weight-bold); }
    .verify-stamp {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-xs) var(--spacing-s);
      background: var(--color-green-10);
      border: 2px solid var(--color-green-00);
      border-radius: var(--radius-sm);
      color: var(--color-green-00);
      font-weight: var(--font-weight-bold);
    }
    .verify-stamp--invalid {
      background: var(--color-red-10);
      border-color: var(--color-red-00);
      color: var(--color-red-00);
    }
  </style>
</head>
<body class="govbb-page">

  <a class="govbb-visually-hidden govbb-visually-hidden-focusable" href="#main-content">Skip to main content</a>

  <div class="govbb-official-banner">
    <div class="govbb-container">
      <div class="govbb-official-banner__inner">
        <span class="govbb-official-banner__crest">
          <img class="govbb-official-banner__icon" src="/assets/images/govbb-creast.svg" alt="" aria-hidden="true" />
        </span>
        <div class="govbb-official-banner__text">
          <span>An official service of the Government of Barbados</span>
        </div>
      </div>
    </div>
  </div>

  <header class="govbb-header">
    <div class="govbb-container">
      <div class="govbb-header__inner">
        <a href="/" aria-label="Ministry of Education job letters — home">
          <img class="govbb-header__logo" src="/assets/images/govbb-logo.svg" alt="Government of Barbados" />
        </a>
        <span class="govbb-text-h4">Job letters</span>
      </div>
    </div>
  </header>

  ${bannerHtml}

  <main id="main-content" class="page-main">
    <div class="govbb-container">
      ${breadcrumbsHtml}
      <div class="content-column stack-lg">
        ${main}
      </div>
    </div>
  </main>

  <footer class="govbb-footer">
    <div class="govbb-container">
      <div class="govbb-footer__inner">
        <nav class="govbb-footer__nav" aria-label="Footer">
          <a class="govbb-footer__link" href="/privacy">Privacy notice</a>
          <a class="govbb-footer__link" href="/accessibility">Accessibility</a>
          <a class="govbb-footer__link" href="/">Job letters home</a>
        </nav>
        <hr class="govbb-footer__divider" />
        <div class="govbb-footer__end">
          <img class="govbb-footer__coat" src="/assets/images/govbb-creast.svg" alt="" aria-hidden="true" />
          <p class="govbb-footer__copy">
            Built by GovTech Barbados with the Ministry of Education Transformation.
            All content is available under the Open Government Licence except where otherwise stated.
          </p>
        </div>
      </div>
    </div>
  </footer>

</body>
</html>`;
}

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
