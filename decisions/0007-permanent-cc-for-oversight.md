# 0007 — Permanent CC for oversight via `EMAIL_CC`

**Status**: Accepted
**Date**: 2026-05

## Context

`RESEND_OVERRIDE_TO` (decisions/0006) is the staging-only redirection
mechanism: while a sender domain is unverified, the override list
replaces citizen recipients on letter delivery and is joined into the
To list on admin credential emails. By design, the override is **unset
on production** — so on production there is currently no mechanism
that gives a designated team member visibility into every outbound
email the service sends.

We have a real need for that visibility independent of environment:
specifically, a service owner / programme manager who must be able to
audit what the service is doing in production without becoming an
admin and without trawling Resend logs after the fact. The mechanism
needs to be data, not code (so the address rotates without a deploy),
and must not interfere with the staging override pattern that already
exists.

## Decision

A second optional environment variable, **`EMAIL_CC`**, is now
recognised by `server/lib/recipients.js`. It is a comma-separated
list of email addresses. When set, every outbound email (letter
delivery, admin sign-in code, admin invite) includes those addresses
in the **Cc** field of the Resend send call. The CC list is
deduplicated against the To list — an address that's already in `to`
is not also added to `cc`, so an admin who happens to also be in
`EMAIL_CC` never receives their own sign-in code via CC.

The helpers in `recipients.js` now return `{ to, cc }` objects rather
than plain arrays. Callers pass both through to Resend:

```js
const { to, cc } = recipientsForLetter(citizenEmail);
await client.emails.send({ from, to, cc: cc.length ? cc : undefined, ... });
```

The intent is **visible** CC, not BCC. The original recipient sees
the oversight address in their `Cc` header — this is appropriate for
a government service where the existence of oversight is itself
expected to be transparent.

## Consequences

A designated oversight address — currently
`adunni.rufai@govtech.bb` — receives a copy of every email the
service emits, on every environment, without being an admin and
without reading server logs. Rotation is one env-var edit and a
redeploy; no code change.

The trade-offs to be aware of:

1. **Resend free-tier delivery constraint applies.** Every address in
   `EMAIL_CC` must be a verified recipient in Resend (or the sender
   domain must be verified). An unverified CC address will cause
   every send to fail. Same caveat as the override; the boring fix
   is the same — verify `moe.gov.bb` in Resend.
2. **The original recipient sees the CC.** They know they were
   copied. Don't put an address here that needs to stay confidential
   from the recipient — use BCC for that, which would require a
   separate `EMAIL_BCC` variable (not currently implemented).
3. **The CC sees sensitive content.** Citizens' letters (attached
   PDFs with name / post / salary) and admin sign-in codes all go to
   the CC. Treat the CC list as an extension of the admin trust
   boundary — every address on it must belong to someone authorised
   to see this material.
4. **No CC tracking in the audit log.** `issued_letters.email_status`
   records the delivery status of the primary send, not per-recipient.
   If the primary delivers but a CC bounces, the audit log won't
   surface it. Resend's own dashboard is the source of truth for
   per-recipient delivery.
5. **`EMAIL_CC` and `RESEND_OVERRIDE_TO` are independent.** Unsetting
   `RESEND_OVERRIDE_TO` on production does not affect `EMAIL_CC`,
   which is meant to run in production. The two mechanisms are
   composed in `recipients.js` and tested for clean interaction
   (dedup, ordering).

When the oversight role changes hands, update `EMAIL_CC` and redeploy.
When it is no longer needed, unset the variable.
