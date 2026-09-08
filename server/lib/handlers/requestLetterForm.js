// The no-JavaScript path for the request form.
//
// request.html posts here with a real action and method. With JavaScript the
// page intercepts submit and uses /api/request-letter instead, so this runs
// only when script is unavailable — which is exactly when it has to work.
//
// Success redirects (303, so a refresh does not resubmit). A validation error
// renders the form again with the messages in place, which cannot be a
// redirect because the static page has no way to display them without script.

import { requestLetter } from "./requestLetter.js";
import { renderPage, escapeHtml } from "../renderPage.js";

// The rendered page is returned by the API, which may sit on a different
// origin from the site. Links and assets have to point back at wherever the
// form was submitted from, and that value comes from the request — so it is
// checked against this list rather than trusted, or it would be an open
// redirect.
const ALLOWED_ORIGINS = new Set([
  "https://govtech-bb.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

// GitHub Pages serves this project from a subpath; everywhere else is root.
function basePathFor(origin) {
  return origin === "https://govtech-bb.github.io"
    ? "/Get-a-job-letter-from-the-Ministry-of-Education/"
    : "/";
}

export function resolveBase({ origin, referer, fallbackOrigin }) {
  let candidate = origin;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      candidate = null;
    }
  }
  if (!candidate || !ALLOWED_ORIGINS.has(candidate)) candidate = fallbackOrigin;
  return candidate.replace(/\/$/, "") + basePathFor(candidate);
}

const FIELDS = ["firstName", "lastName", "employeeId", "email"];

const LABELS = {
  firstName: "First name",
  lastName: "Last name",
  employeeId: "Employee ID",
  email: "Government email address",
};

const HINTS = {
  employeeId: "This is your National Registration number, for example 090472-0497",
  email: "Must be from an allowed domain, for example juniper.boyce@moe.gov.bb",
};

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
        <input class="govbb-input" id="${name}" name="${name}" type="${name === "email" ? "email" : "text"}"
          value="${escapeHtml(value)}"${error ? ' aria-invalid="true"' : ""}${
    describedBy ? ` aria-describedby="${describedBy}"` : ""
  } />
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
        Your letter will be sent to the government email address you provide.
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
export async function handleFormSubmit({ body, base, action, publicBaseUrl, submit = requestLetter }) {
  const values = Object.fromEntries(
    FIELDS.map((f) => [f, String(body?.[f] ?? "").trim()])
  );

  const result = await submit({ ...values, publicBaseUrl });

  if (result.status === 200 && result.body?.ok) {
    return { redirect: `${base}sent.html` };
  }

  // requestLetter reports field-level problems as { field, message }. Anything
  // else — a rejected domain, no matching record — comes back as a single
  // message with no field, so it is shown against the email input, which is
  // the answer it is about.
  const errors =
    result.body?.errors?.length
      ? result.body.errors
      : [{ field: "email", message: result.body?.message || "We could not find a matching record." }];

  return { html: renderFormPage({ values, errors, base, action }), status: result.status || 400 };
}
