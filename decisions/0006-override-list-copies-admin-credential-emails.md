# 0006 — Override list also copies admin credential emails

**Status**: Accepted
**Date**: 2026-05
**Supersedes**: [0004](0004-admin-emails-bypass-resend-override.md)

## Context

ADR 0004 ruled that admin sign-in codes and invitation emails bypass
`RESEND_OVERRIDE_TO` entirely, on the basis that routing a credential
anywhere other than the credential's owner is a usability bug and a
quiet security problem. In practice, during multi-person testing we
need a small in-team test cohort to be able to observe credential
emails landing in real time without each tester having to be added to
the `admins` allowlist. The original "send to admin only" rule made
that impossible — only the admin themselves could confirm an invite or
sign-in code actually arrived.

## Decision

`RESEND_OVERRIDE_TO` is now a **comma-separated list** of email
addresses, parsed once by `server/lib/recipients.js`. Two helpers
encode the routing rules:

- **`recipientsForLetter(to)`** — for user-facing letter delivery.
  Returns the override list if set (the citizen does not receive the
  email — protects real citizens from being spammed by staging);
  otherwise returns just the citizen's address.
- **`recipientsForAdminEmail(adminEmail)`** — for admin credential
  emails (sign-in codes, invites). Always returns the admin's real
  address, plus everyone in the override list, deduplicated
  case-insensitively. The admin always gets their email; the override
  list gets a copy.

Both `sendCodeEmail` (`server/lib/adminAuth.js`) and `sendInviteEmail`
(`server/lib/handlers/adminAdmins.js`) now call
`recipientsForAdminEmail`. `sendLetterEmail` (`server/lib/email.js`)
calls `recipientsForLetter`.

## Consequences

Multi-person testing of the admin sign-in flow works without enlarging
the admin allowlist or sharing passwords. It also re-introduces the
risk ADR 0004 was guarding against: every address in the override list
sees every admin's sign-in codes. This is acceptable **only** while
the override is configured with the in-team test cohort and **only**
while a verified `moe.gov.bb` sender domain is still pending in
Resend. Two operational rules follow:

1. `RESEND_OVERRIDE_TO` must be unset (or empty) on production
   deployments. The promotion checklist (see principle 6 in the
   `principles/` document) must verify this before each promotion to
   main.
2. The override list must contain only addresses owned by team members
   who are entitled to see every admin's credential traffic. If a
   teammate leaves the test cohort, remove their address the same day.

Once `moe.gov.bb` is verified in Resend and the override env var is
unset everywhere, both helpers return only the original recipient and
no credential leakage is possible. At that point this ADR can be
revisited and tightened back toward 0004's stricter rule if desired.
