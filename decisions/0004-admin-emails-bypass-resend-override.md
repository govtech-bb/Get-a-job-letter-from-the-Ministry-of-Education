# 0004 — Admin sign-in codes bypass `RESEND_OVERRIDE_TO`

**Status**: Superseded by [0006](0006-override-list-copies-admin-credential-emails.md)
**Date**: 2026-05

## Context

In staging and during free-tier Resend use, we redirect every outbound
email to a single verified inbox using the `RESEND_OVERRIDE_TO`
environment variable. This is appropriate for letter delivery: it lets
the team see the user experience without spamming citizens, and it works
around Resend's free-tier restriction (transactional sends only go to the
verified account-owner address until a sender domain is verified). The
first version of admin authentication honoured the same override — which
meant that when a new admin was added, the 6-digit sign-in code went to
the override inbox instead of to the admin's own mailbox, and they
could not sign in. We hit this bug twice before identifying it.

## Decision

The `sendCodeEmail` function in `server/lib/adminAuth.js` and the
`sendInviteEmail` function in `server/lib/handlers/adminAdmins.js`
**deliberately do not honour `RESEND_OVERRIDE_TO`**. Sign-in codes and
admin invitation messages are sent to the actual admin email address.
The override is still honoured by the user-facing letter-delivery path
in `server/lib/email.js`. The reasoning is that a sign-in code is a
credential: routing it anywhere other than the credential's owner is
both a usability bug (admins cannot log in) and a quiet security
problem (any other admin sharing the override inbox sees credentials
that aren't theirs).

## Consequences

Admin email addresses must be on Resend's verified-recipients list, or
the sender domain must be verified, or sign-in will fail in staging.
This is a real constraint and is what motivates the boring-but-deferred
"verify `moe.gov.bb` in Resend" task. If a future maintainer "tidies up"
the override handling and removes the carve-out without understanding
this ADR, sign-in will silently break for new admins. The carve-out is
narrow on purpose: it applies to the two named functions and nothing
else. Any new admin-management email (e.g. role-change notifications)
must explicitly decide whether the override applies, and document that
decision next to the call site.
