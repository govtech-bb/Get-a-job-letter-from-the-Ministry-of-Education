# 0001 — Magic-link admin authentication

**Status**: Accepted
**Date**: 2026-05

## Context

The admin console needs to be reachable by Ministry of Education personnel
staff — a small group whose membership changes only when people join or
leave the team. The Ministry does not run a central identity provider we
can federate against, and the Government of Barbados does not currently
provide an SSO service that covers this kind of internal tool. We
considered three options: username + password (with our own user store and
reset flow), federated SSO via Google or Microsoft work accounts, and
email-based magic links with a one-time code.

## Decision

Admin authentication is a two-step magic link:

1. The admin enters their work email at `/admin/login.html`. If the address
   is on the allowlist in the `admins` table, a 6-digit code is sent to that
   inbox via Resend. The endpoint always responds `ok` regardless of whether
   the address is on the allowlist, to prevent enumeration of admin emails.
2. The admin enters the code; if it matches the hash stored in `admin_codes`
   and is within its 10-minute TTL, a long-lived session token is created in
   `admin_sessions` and set as an httpOnly cookie (`moe_admin_session`).

Codes are 6 random digits, stored as SHA-256 hashes, and rate-limited to 5
attempts before requiring a fresh request. Sessions are 8 hours and are
revoked on sign-out or when the admin row is set to `is_active = FALSE`.

## Consequences

We avoid running a password store, a reset flow, and the operational burden
that comes with both. We do not depend on Google or Microsoft account
infrastructure, which keeps the service portable across deployments. The
trade-off is that the security of admin sign-in is now tied to the security
of the admin's email inbox, and to Resend's deliverability — if Resend is
slow or the code lands in spam, the admin cannot sign in. Mitigations: codes
have a 10-minute TTL (long enough for a delayed mail server), the admin
allowlist is small enough that failures can be diagnosed individually, and
the underlying provider error is logged server-side (see
`server/lib/adminAuth.js`) without being shown to the user. Future work
should consider WebAuthn as a second factor for the super_admin role; this
ADR does not preclude that.
