// Page-level templates. Each returns the inner `main` HTML, which the layout wraps.
import { escapeHtml } from "./layout.js";

export function startPage() {
  return `
    <div class="stack">
      <h1 class="govbb-text-h1">Get a job letter from the Ministry of Education Transformation</h1>
      <p class="govbb-text-body-lg">
        Use this service to get an official letter that confirms your employment,
        your post and your salary. You can show this letter to a bank, credit union
        or retailer.
      </p>
    </div>

    <div class="stack">
      <h2 class="govbb-text-h2">Before you start</h2>
      <p class="govbb-text-body">You'll need your work email address — the one the Ministry uses to write to you.</p>
      <p class="govbb-text-body">It takes around 2 minutes. The letter is generated from the records the Ministry already holds about you.</p>
    </div>

    <div class="stack">
      <a class="govbb-btn" href="/request" role="button">Start now</a>
    </div>

    <details class="govbb-show-hide">
      <summary class="govbb-show-hide__summary">Who can use this service</summary>
      <div class="govbb-show-hide__content">
        <p>You can use this service if you are currently employed by the Ministry of Education Transformation as:</p>
        <ul class="govbb-list govbb-list--bullet">
          <li>a teacher (appointed or with special responsibility)</li>
          <li>a member of general Ministry staff, permanent or temporary</li>
          <li>ancillary or support staff</li>
        </ul>
        <p>If your record is not on the system, contact your school's personnel officer or the Ministry's Personnel Department.</p>
      </div>
    </details>

    <details class="govbb-show-hide">
      <summary class="govbb-show-hide__summary">How the letter is verified</summary>
      <div class="govbb-show-hide__content">
        <p>Every letter carries a QR code and a verification link. A bank or retailer can scan it to confirm the letter is genuine and shows the most current information.</p>
        <p>This replaces the older paper process, where letters could be altered after they were issued.</p>
      </div>
    </details>
  `;
}

export function requestPage({ error = null, email = "" } = {}) {
  const errorSummary = error
    ? `<div class="govbb-error-summary" role="alert" aria-labelledby="error-summary-title">
         <h2 class="govbb-error-summary__title" id="error-summary-title">There is a problem</h2>
         <ul class="govbb-error-summary__list">
           <li><a class="govbb-error-summary__link" href="#email">${escapeHtml(error)}</a></li>
         </ul>
       </div>`
    : "";

  const invalidAttr = error ? ` aria-invalid="true" aria-describedby="email-error"` : "";
  const inlineError = error
    ? `<span class="govbb-error-message" id="email-error">${escapeHtml(error)}</span>`
    : "";

  return `
    ${errorSummary}

    <div class="stack">
      <h1 class="govbb-text-h1">What is your work email address?</h1>
      <p class="govbb-text-body">
        We use this to match you to your record. If it matches, we'll generate
        your letter and send it to that address.
      </p>
    </div>

    <form method="post" action="/request" novalidate>
      <div class="govbb-form-group">
        <label class="govbb-label" for="email">Work email address</label>
        <span class="govbb-hint" id="email-hint">For example, jane.doe@moe.gov.bb</span>
        ${inlineError}
        <div class="govbb-input-wrapper">
          <input
            class="govbb-input"
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            spellcheck="false"
            aria-describedby="email-hint"
            value="${escapeHtml(email)}"${invalidAttr}
            required />
        </div>
      </div>

      <div class="govbb-btn-group" style="margin-top: var(--spacing-m);">
        <button class="govbb-btn" type="submit">Continue</button>
        <a class="govbb-btn--link" href="/">Cancel</a>
      </div>
    </form>

    <details class="govbb-show-hide">
      <summary class="govbb-show-hide__summary">Why we ask for your work email</summary>
      <div class="govbb-show-hide__content">
        <p>Receiving the email at your work mailbox proves you are who you say you are. The letter is sent to that mailbox and nowhere else.</p>
        <p>If your email has changed recently, contact your school's personnel officer to update the Ministry's record before requesting a letter.</p>
      </div>
    </details>
  `;
}

export function sentPage({ email, letterUrl }) {
  return `
    <div class="panel-success stack">
      <h1 class="govbb-text-h2">Your letter is on its way</h1>
      <p class="govbb-text-body">
        We've sent your job letter to
        <strong>${escapeHtml(email)}</strong>.
        It should arrive within a few minutes.
      </p>
    </div>

    <div class="stack">
      <h2 class="govbb-text-h3">What happens next</h2>
      <ol class="govbb-list govbb-list--number">
        <li>Open the email from <strong>noreply@moe.gov.bb</strong>.</li>
        <li>Download the attached PDF letter.</li>
        <li>Forward or print the letter to share with your bank or retailer.</li>
      </ol>
    </div>

    <div class="panel-info stack">
      <h2 class="govbb-text-h4">For this prototype</h2>
      <p class="govbb-text-body">
        Email isn't actually sent in this alpha. You can open your letter directly to see what it looks like.
      </p>
      <p>
        <a class="govbb-btn--tertiary" href="${escapeHtml(letterUrl)}">Open your letter</a>
      </p>
    </div>

    <p><a class="govbb-link" href="/">Back to start</a></p>
  `;
}

export function notFoundPage({ email }) {
  return `
    <div class="panel-warning stack">
      <h1 class="govbb-text-h2">We could not find a record for that email</h1>
      <p class="govbb-text-body">
        We have no employee record matching
        <strong>${escapeHtml(email)}</strong>.
      </p>
    </div>

    <div class="stack">
      <h2 class="govbb-text-h3">What you can do</h2>
      <ul class="govbb-list govbb-list--bullet">
        <li>Check the address for typos and <a class="govbb-link" href="/request">try again</a>.</li>
        <li>If you've recently joined, your record may not have reached this system yet — contact your school's personnel officer.</li>
        <li>If your work email has changed, your record may still have the old one. Ask your personnel officer to update it.</li>
      </ul>
    </div>

    <p><a class="govbb-link" href="/">Back to start</a></p>
  `;
}

export function letterReadyPage({ letter, downloadUrl, verifyUrl, previewHtml }) {
  return `
    <div class="panel-success stack">
      <h1 class="govbb-text-h2">Your job letter</h1>
      <p class="govbb-text-body">
        Issued ${escapeHtml(formatDate(letter.issuedAt))} for
        <strong>${escapeHtml(letter.employee.firstName)} ${escapeHtml(letter.employee.lastName)}</strong>.
      </p>
    </div>

    <div class="govbb-btn-group">
      <a class="govbb-btn" href="${escapeHtml(downloadUrl)}" download>Download PDF letter</a>
      <a class="govbb-btn--tertiary" href="${escapeHtml(verifyUrl)}" target="_blank" rel="noopener">View verification page</a>
    </div>

    <div class="stack">
      <h2 class="govbb-text-h3">Letter reference</h2>
      <dl class="key-value">
        <dt>Reference number</dt>
        <dd><code>${escapeHtml(letter.id)}</code></dd>
        <dt>Issued at</dt>
        <dd>${escapeHtml(formatDateTime(letter.issuedAt))}</dd>
        <dt>Valid until</dt>
        <dd>${escapeHtml(formatDate(letter.validUntil))}</dd>
      </dl>
      <p class="govbb-text-caption">
        Anyone receiving this letter can verify it by scanning the QR code on the letter,
        or by visiting the verification link printed on it.
      </p>
    </div>

    <details class="govbb-show-hide" open>
      <summary class="govbb-show-hide__summary">Preview the letter</summary>
      <div class="govbb-show-hide__content">
        ${previewHtml}
      </div>
    </details>
  `;
}

export function verifyPage({ valid, letter = null, reason = null }) {
  if (!valid) {
    return `
      <div class="panel-error stack">
        <h1 class="govbb-text-h2">This letter could not be verified</h1>
        <p class="govbb-text-body">${escapeHtml(reason || "The reference is invalid or has been tampered with.")}</p>
      </div>

      <div class="stack">
        <h2 class="govbb-text-h3">What to do</h2>
        <p class="govbb-text-body">
          If you received this letter from someone claiming to be a Ministry of Education employee,
          do not rely on it. Ask them to issue a new letter via this service.
        </p>
        <p class="govbb-text-body">
          For help, contact the Ministry's Personnel Department.
        </p>
      </div>
    `;
  }

  return `
    <div class="stack">
      <span class="verify-stamp">✓ Verified — this letter is genuine</span>
      <h1 class="govbb-text-h1">Job letter verification</h1>
      <p class="govbb-text-body-lg">
        This letter was issued by the Ministry of Education Transformation and is current.
      </p>
    </div>

    <div class="stack">
      <h2 class="govbb-text-h3">What this letter confirms</h2>
      <dl class="key-value">
        <dt>Employee</dt>
        <dd>${escapeHtml(letter.employee.title)} ${escapeHtml(letter.employee.firstName)} ${escapeHtml(letter.employee.lastName)}</dd>
        <dt>Post</dt>
        <dd>${escapeHtml(letter.employee.post)}${letter.employee.school ? ", " + escapeHtml(letter.employee.school) : ""}</dd>
        <dt>Employer</dt>
        <dd>${escapeHtml(letter.employee.employer)}</dd>
        <dt>Employment status</dt>
        <dd>${escapeHtml(employmentLabel(letter.employee.letterType))}</dd>
        <dt>Issued on</dt>
        <dd>${escapeHtml(formatDate(letter.issuedAt))}</dd>
        <dt>Reference</dt>
        <dd><code>${escapeHtml(letter.id)}</code></dd>
      </dl>
      <p class="govbb-text-caption" style="color: var(--color-text-muted);">
        Salary information is on the letter itself and is not shown on this public page.
      </p>
    </div>

    <details class="govbb-show-hide">
      <summary class="govbb-show-hide__summary">About this verification</summary>
      <div class="govbb-show-hide__content">
        <p>
          Each letter is signed with a code held by the Ministry. We check the code on this page.
          If the letter has been altered, the code will not match and verification will fail.
        </p>
        <p>
          Verification reflects the Ministry's record at the time the letter was issued. If the
          employee has since left or changed posts, this page will continue to show what the
          letter says.
        </p>
      </div>
    </details>
  `;
}

export function genericInfoPage({ title, body }) {
  return `
    <h1 class="govbb-text-h1">${escapeHtml(title)}</h1>
    ${body}
    <p><a class="govbb-link" href="/">Back to start</a></p>
  `;
}

function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function formatDateTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
function employmentLabel(letterType) {
  switch (letterType) {
    case "teacher_appointed": return "Permanent and pensionable (teacher)";
    case "teacher_special": return "Permanent and pensionable (teacher with special responsibility)";
    case "ministry_permanent": return "Permanent and pensionable";
    case "ministry_temporary": return "Temporary employment";
    default: return "Employed";
  }
}
