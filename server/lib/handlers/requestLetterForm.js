// The no-JavaScript path for the request form.
//
// request.html posts here with a real action and method. With JavaScript the
// page intercepts submit and uses /api/request-letter instead, so this runs
// only when script is unavailable — which is exactly when it has to work.
//
// Success redirects (303, so a refresh does not resubmit). A validation error
// renders the form again with the messages in place, which cannot be a
// redirect because the static page has no way to display them without script.

import { LABELS, HINTS } from "../validationMessages.js";
import { requestLetter } from "./requestLetter.js";
import { renderPage, escapeHtml } from "../renderPage.js";

// Every origin this service is served from. The rendered page and the redirect
// both point back at wherever the form was submitted from, and that value
// arrives in request headers — which are attacker-controlled, so nothing here
// is derived from them without being matched against this list first.
//
// req.headers.host in particular is NOT trustworthy: a request can carry any
// Host it likes, and using it raw produced both an open redirect and, once
// interpolated into the page, reflected XSS.
const KNOWN_SITES = [
  { origin: "https://govtech-bb.github.io", path: "/Get-a-job-letter-from-the-Ministry-of-Education/" },
  { origin: "https://moe-letters.vercel.app", path: "/" },
  { origin: "https://get-a-job-letter.netlify.app", path: "/" },
  { origin: "http://localhost:3000", path: "/" },
  { origin: "http://127.0.0.1:3000", path: "/" },
];

// Where a letter's verification link points. It is embedded in the emailed PDF
// and its QR code, so it has to outlive the request that created it and must
// never come from a header — a forged Host would mint letters whose permanent
// verify URL points somewhere else.
const CANONICAL_ORIGIN =
  process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || "https://moe-letters.vercel.app";

function siteFor(origin) {
  return KNOWN_SITES.find((s) => s.origin === origin) || null;
}

/**
 * The absolute origin + path to render links and redirect against. Falls back
 * to the canonical site rather than to anything derived from the request.
 */
export function resolveBase({ origin, referer } = {}) {
  let site = siteFor(origin);

  if (!site && referer) {
    try {
      site = siteFor(new URL(referer).origin);
    } catch {
      site = null;
    }
  }

  if (!site) site = siteFor(CANONICAL_ORIGIN) || KNOWN_SITES[0];
  return site.origin + site.path;
}

/** The origin baked into the letter. Never request-derived. */
export function verificationBase() {
  return CANONICAL_ORIGIN;
}

const FIELDS = ["firstName", "lastName", "employeeId", "email"];



function field(name, value, error, base) {
  const hint = HINTS[name]
    ? `<span class="govbb-hint" id="${name}-hint">${escapeHtml(HINTS[name])}</span>`
    : "";
  const err = error
    ? `<span class="govbb-error-message" id="${name}-error">${escapeHtml(error)}</span>`
    : "";
  const describedBy = [HINTS[name] ? `${name}-hint` : null, error ? `${name}-error` : null]
    .filter(Boolean)
    .join(" ");

  return `      <div class="govbb-form-group">
        <label class="govbb-label" for="${name}">${escapeHtml(LABELS[name])}</label>
        ${hint}
        ${err}
        <div class="govbb-input-wrapper">
          <input class="govbb-input" id="${name}" name="${name}" type="${name === "email" ? "email" : "text"}"
            value="${escapeHtml(value)}"${error ? ' aria-invalid="true"' : ""}${
    describedBy ? ` aria-describedby="${describedBy}"` : ""
  } />
        </div>
      </div>`;
}

function errorSummary(errors) {
  if (!errors.length) return "";
  const items = errors
    .map(
      (e) =>
        `          <li><a class="govbb-link govbb-error-summary__link" href="#${e.field}">${escapeHtml(
          e.message
        )}</a></li>`
    )
    .join("\n");
  return `      <div class="govbb-error-summary" role="alert" tabindex="-1" aria-labelledby="error-summary-title">
        <h2 class="govbb-error-summary__title" id="error-summary-title">There is a problem</h2>
        <ul class="govbb-error-summary__list">
${items}
        </ul>
      </div>`;
}

export function renderFormPage({ values, errors, base, action }) {
  const byField = Object.fromEntries(errors.map((e) => [e.field, e.message]));

  const main = `${errorSummary(errors)}
    <div class="govbb-service-heading">
      <p class="govbb-service-heading__service">Job letters</p>
      <h1 class="govbb-text-h1">Enter your details</h1>
      <p class="govbb-service-heading__description">
        We use your name and employee ID to match you to your record.
        Your letter will be sent to the work email address you provide.
      </p>
    </div>

    <form method="post" action="${escapeHtml(action)}" novalidate>
${FIELDS.map((f) => field(f, values[f] || "", byField[f], base)).join("\n\n")}

      <div class="govbb-button-group">
        <a class="govbb-button govbb-button--secondary" href="${base}index.html">Cancel</a>
        <button class="govbb-button" type="submit">Continue</button>
      </div>
    </form>`;

  return renderPage({ title: "Enter your details", main, base });
}

/**
 * Runs the whole no-JS submit. Returns either a redirect or a page to render,
 * so the Vercel function and the dev server share one implementation.
 */
export async function handleFormSubmit({ body, base, action, submit = requestLetter }) {
  const values = Object.fromEntries(
    FIELDS.map((f) => [f, String(body?.[f] ?? "").trim()])
  );

  // publicBaseUrl is baked into the letter's PDF and QR code, so it comes from
  // the canonical origin, never from where this particular request came from.
  const result = await submit({ ...values, publicBaseUrl: verificationBase() });

  if (result.status === 200 && result.body?.ok) {
    return { redirect: `${base}sent.html` };
  }

  // Match how app.js routes each outcome, so the two paths tell the user the
  // same thing. Only genuine field-level problems re-render the form.
  if (result.body?.errors?.length) {
    return {
      html: renderFormPage({ values, errors: result.body.errors, base, action }),
      status: result.status || 400,
    };
  }

  if (result.body?.error === "not_found") {
    return { redirect: `${base}not-found.html` };
  }

  // The letter exists but the email failed. Re-rendering the form would invite
  // a resubmit, and a resubmit issues a second letter — so say what happened
  // and do not offer the form again.
  if (result.body?.error === "email_send_failed") {
    return {
      status: result.status || 502,
      html: renderPage({
        title: "We could not send your letter",
        base,
        main: `    <h1 class="govbb-text-h1">We could not send your letter</h1>
    <p class="govbb-text-body">
      Your letter was generated, but the email did not go out. Do not request
      another one — try again in a few minutes, or contact your school's
      personnel officer if it still does not arrive.
    </p>
    <p class="govbb-text-body"><a class="govbb-link" href="${base}index.html">Return to the start</a></p>`,
      }),
    };
  }

  return {
    status: result.status || 400,
    html: renderFormPage({
      values,
      errors: [{ field: "email", message: result.body?.message || "We could not process your request." }],
      base,
      action,
    }),
  };
}
