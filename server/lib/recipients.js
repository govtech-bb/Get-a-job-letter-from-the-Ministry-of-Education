// Recipient routing for outbound emails.
//
// Two environment-driven mechanisms:
//
//  - `RESEND_OVERRIDE_TO` (comma-separated)
//      Staging-only redirection. Used while a real `moe.gov.bb` sender
//      domain is unverified in Resend so we can test without spamming real
//      citizens. See decisions/0006 for the routing rules.
//
//  - `EMAIL_CC` (comma-separated)
//      Permanent oversight CC. Every outbound email CCs each address in
//      this list, regardless of environment, with deduplication against
//      the To list so nobody gets their own message in CC.
//      See decisions/0007.
//
// Both env vars are optional. Unset = empty list = no effect.
//
// Helpers return { to, cc } objects so callers can pass them straight
// through to Resend's `emails.send`.

function parseList(envName) {
  const raw = process.env[envName] || "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function dedupeAgainst(candidates, alreadyIncluded) {
  const lowered = new Set(alreadyIncluded.map(a => a.toLowerCase()));
  return candidates.filter(addr => !lowered.has(addr.toLowerCase()));
}

/**
 * Recipients for a user-facing letter-delivery email.
 *
 * Returns `{ to, cc }`:
 *   - `to`: the override list if set (don't email real citizens from
 *     staging), otherwise the original recipient.
 *   - `cc`: every address in EMAIL_CC that isn't already in `to`.
 */
export function recipientsForLetter(to) {
  const override = parseList("RESEND_OVERRIDE_TO");
  const toList = override.length ? override : [to];
  const cc = dedupeAgainst(parseList("EMAIL_CC"), toList);
  return { to: toList, cc };
}

/**
 * Recipients for an admin credential email (sign-in code, invitation).
 *
 * Returns `{ to, cc }`:
 *   - `to`: the admin's real email plus the override list, deduplicated
 *     case-insensitively (the admin must always receive their code).
 *   - `cc`: every address in EMAIL_CC that isn't already in `to`.
 */
export function recipientsForAdminEmail(adminEmail) {
  const seen = new Map();
  for (const r of [adminEmail, ...parseList("RESEND_OVERRIDE_TO")]) {
    if (r) seen.set(r.toLowerCase(), r);
  }
  const toList = Array.from(seen.values());
  const cc = dedupeAgainst(parseList("EMAIL_CC"), toList);
  return { to: toList, cc };
}
