// The confirmation page for the no-JavaScript path.
//
// With script, sent.html fills itself in from sessionStorage. Without it, the
// redirect after the form POST carries nothing, so the page could only say
// "the address you gave" — it did not know which address.
//
// This renders the same confirmation server-side. The reference and token in
// the URL identify the letter; the address is read from the stored record, so
// it never travels in a query string, never reaches a log or a browser history
// entry, and cannot be changed by editing the URL.
//
// A redirect rather than rendering on the POST response, so refreshing the
// confirmation does not resubmit the form and issue a second letter.

import { renderPage, escapeHtml } from "../renderPage.js";

function page({ base, main, title, status }) {
  return { status, html: renderPage({ title, base, main }) };
}

/**
 * @param {object} o
 * @param {string} o.id      letter reference from the URL
 * @param {string} o.token   its signature from the URL
 * @param {string} o.base    absolute origin + path to render links against
 * @param {(id: string) => Promise<any>} o.lookup  in-memory or database
 */
export async function renderLetterSent({ id, token, base, lookup }) {
  const notFound = () =>
    page({
      base,
      status: 404,
      title: "We could not find that letter",
      main: `    <h1 class="govbb-text-h2">We could not find that letter</h1>
    <p>The link may be incomplete, or the letter may have been issued too long ago.</p>
    <p><a class="govbb-link" href="${base}index.html">Request a job letter</a></p>`,
    });

  if (!id || !token) return notFound();

  const letter = await lookup(id).catch(() => null);
  if (!letter) return notFound();

  // The in-memory store calls it token, the database calls it signature.
  const stored = letter.token ?? letter.signature;
  if (!stored || stored !== token) return notFound();

  const email = letter.recipientEmail;

  return page({
    base,
    status: 200,
    title: "Letter sent",
    main: `    <div class="confirm-panel">
      <h1 class="govbb-text-h2 confirm-panel__title">Letter sent</h1>
      <p class="govbb-text-body-lg confirm-panel__detail">
        We&rsquo;ve emailed your job letter to ${
          email ? `<strong>${escapeHtml(email)}</strong>` : "the address you gave"
        }.
      </p>
      <p class="govbb-text-body-sm confirm-panel__ref">
        Reference: <code>${escapeHtml(id)}</code>
      </p>
    </div>

    <h2>What happens next</h2>
    <ol>
      <li>Open the email. It should arrive within a few minutes.</li>
      <li>Download the attached PDF letter.</li>
      <li>Forward or print the letter to share with your bank, credit union or retailer.</li>
    </ol>
    <p>Not in your inbox after a few minutes? Check your spam or junk folder.</p>
    <p><a class="govbb-link" href="${base}index.html">Back to start</a></p>`,
  });
}
