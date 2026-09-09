// The one copy of every message the request form can show.
//
// Three things render this form: the browser script in request.html, the
// no-JavaScript POST handler in requestLetterForm.js, and the API handlers
// requestLetter.js and requestLetterLocal.js. They used to carry their own
// wording, so the same failure read differently depending on whether your
// browser ran the script — "Enter a valid email address" on one path and
// "Enter an email address in the correct format, for example
// jane.doe@moe.gov.bb" on the other.
//
// request.html cannot import this: its validation is an inline script and the
// page is served as a static file. Its strings are checked against this module
// by test/requestFormMessages.test.js instead, so the two cannot drift apart
// silently.

export const LABELS = {
  firstName: "First name",
  lastName: "Last name",
  employeeId: "Employee ID",
  email: "Work email address",
};

// employeeId has no hint. It used to say "This is your National Registration
// number, for example 090472-0497", which contradicted both the label and the
// employeeId values the service actually matches on. What the number is called
// on a payslip, and how it is formatted, is still an open question for the
// Ministry (#29) — until that is answered there is nothing true to say here.
export const HINTS = {
  email: "Must be from an allowed domain, for example juniper.boyce@moe.gov.bb",
};

export const MESSAGES = {
  firstNameMissing: "Enter your first name",
  lastNameMissing: "Enter your last name",
  employeeIdMissing: "Enter your employee ID",
  emailMissing: "Enter your work email address",
  emailFormat: "Enter an email address in the correct format, for example jane.doe@moe.gov.bb",
  emailNameMismatch: "Your email address does not appear to match the name you entered",
  recordNotFound: "We could not find a record for that employee ID.",
  nameDoesNotMatch: "The name you entered does not match the record for that employee ID.",
};

// Naming the domains is the whole point of the message: without them the user
// is told a rule they cannot check. The list is admin-managed, so it is passed
// in rather than hardcoded.
export function emailDomainMessage(allowedDomains) {
  return `Enter an email address from an allowed domain (${allowedDomains.join(", ")})`;
}
