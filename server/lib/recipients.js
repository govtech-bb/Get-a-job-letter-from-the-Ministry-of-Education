// Recipient routing for outbound emails.
//
// `RESEND_OVERRIDE_TO` is a comma-separated list of email addresses we
// redirect outbound mail to while a real `moe.gov.bb` sender domain is
// unverified in Resend. It exists for two reasons:
//
//   1. Letter-delivery emails should never reach real citizens from staging,
//      so when the override is set, the citizen's email is REPLACED with the
//      list (citizens get nothing).
//
//   2. Admin credential emails (sign-in codes, invites) must still reach the
//      admin so they can actually sign in, but the team also wants to observe
//      them landing in real time. So admin emails are sent to the admin
//      AND the override list, deduplicated.
//
// Once the sender domain is verified, set `RESEND_OVERRIDE_TO` to empty (or
// unset it) on production and both helpers below return just the original
// recipient. See decisions/0004 (superseded) and decisions/0006.

function parseOverride() {
  const raw = process.env.RESEND_OVERRIDE_TO || "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Recipients for a user-facing letter-delivery email.
 * If the override is set, REPLACE the original recipient with the override
 * list (don't email real citizens from staging). Otherwise, send only to
 * the original recipient.
 */
export function recipientsForLetter(to) {
  const override = parseOverride();
  return override.length ? override : [to];
}

/**
 * Recipients for an admin credential email (sign-in code, invitation).
 * Always include the admin's real email — they need it to sign in — plus
 * any addresses in the override list, deduplicated case-insensitively so
 * an admin who happens to also be in the override list isn't double-mailed.
 */
export function recipientsForAdminEmail(adminEmail) {
  const seen = new Map();
  for (const r of [adminEmail, ...parseOverride()]) {
    if (r) seen.set(r.toLowerCase(), r);
  }
  return Array.from(seen.values());
}
