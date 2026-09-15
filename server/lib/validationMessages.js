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
  employeeId: "National Identification (ID) number",
  email: "Work email address",
};

// The employeeId label is the one alpha.gov.bb forms use. The hint names the
// card because many people know the number as their National Registration
// number rather than by the label.
export const HINTS = {
  employeeId: "This is on your National Registration card. For example, 850101-0001",
  email: "Must be from an allowed domain, for example juniper.boyce@moe.gov.bb",
};

export const MESSAGES = {
  firstNameMissing: "Enter your first name",
  lastNameMissing: "Enter your last name",
  employeeIdMissing: "Enter your National Identification (ID) number",
  employeeIdFormat: "Enter a valid National Identification (ID) number (for example, 850101-0001)",
  emailMissing: "Enter your work email address",
  emailFormat: "Enter an email address in the correct format, for example jane.doe@moe.gov.bb",
  emailNameMismatch: "Your email address does not appear to match the name you entered",
  recordNotFound: "We could not find a record for that National Identification (ID) number.",
  nameDoesNotMatch: "The name you entered does not match the record for that National Identification (ID) number.",
};

// Naming the domains is the whole point of the message: without them the user
// is told a rule they cannot check. The list is admin-managed, so it is passed
// in rather than hardcoded.
export function emailDomainMessage(allowedDomains) {
  return `Enter an email address from an allowed domain (${allowedDomains.join(", ")})`;
}
