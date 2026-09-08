// Minimal server-rendered page shell, for the no-JavaScript form path.
//
// The static pages get their chrome baked in at build time by
// scripts/build-pages.js. A validation error has to be rendered at request
// time instead, so the same templates are reused here rather than copied —
// scripts/chrome.js is plain ESM with no dependencies, and having one source
// for the header and footer is worth importing across that boundary.

import {
  skipLink,
  officialBanner,
  header,
  alphaBanner,
  footer,
} from "../../scripts/chrome.js";

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {object} o
 * @param {string} o.title      document title
 * @param {string} o.main       markup for inside <main>
 * @param {string} o.base       absolute origin + path the site is served from,
 *                              with a trailing slash — this page is rendered by
 *                              the API, which may be on a different origin from
 *                              the site, so every asset and link is absolute.
 */
export function renderPage({ title, main, base }) {
  const chrome = (t) => t.replace(/\{\{base\}\}/g, base);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Job letters — Ministry of Education</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="${base}assets/images/favicon.ico" />
  <link rel="stylesheet" href="${base}styles.css" />
  <link rel="stylesheet" href="${base}page.css" />
</head>
<body class="govbb-page">
${chrome(skipLink + officialBanner + header + alphaBanner)}

  <main class="govbb-width-container govbb-main-wrapper page-flow" id="main-content" tabindex="-1">
${main}
  </main>
${chrome(footer)}
</body>
</html>`;
}
