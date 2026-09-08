// Shape check for an email address, without a regular expression.
//
// The pattern this replaces — /^[^\s@]+@[^\s@]+\.[^\s@]+$/ — backtracks
// polynomially on attacker-controlled input, because [^\s@] also matches ".",
// so "[^\s@]+\.[^\s@]+" can split a long string in many ways before failing.
// CodeQL flags it as js/polynomial-redos, and it appeared in four places
// server-side. This is linear, does the same job, and is easier to read.
//
// Deliberately only a shape check. Whether an address is real, and whether its
// domain is allowed, are separate questions answered elsewhere.

// RFC 5321 caps a path at 254 characters. Rejecting longer input first also
// bounds the work regardless of what is sent.
const MAX_LENGTH = 254;

export function isEmailFormat(value) {
  const email = String(value ?? "");
  if (!email || email.length > MAX_LENGTH) return false;
  if (/\s/.test(email)) return false; // linear: no repetition to backtrack

  const at = email.indexOf("@");
  if (at < 1) return false; // missing, or nothing before it
  if (email.indexOf("@", at + 1) !== -1) return false; // more than one

  const domain = email.slice(at + 1);
  const dot = domain.indexOf(".");
  // A dot is required, and cannot start or end the domain.
  return dot > 0 && dot < domain.length - 1;
}
