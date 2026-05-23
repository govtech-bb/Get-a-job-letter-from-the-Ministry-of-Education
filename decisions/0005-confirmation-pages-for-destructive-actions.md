# 0005 — Confirmation pages for destructive admin actions

**Status**: Accepted
**Date**: 2026-05

## Context

The admin console allows actions that change other people's access or
visibility — deactivating an employee, deactivating another admin,
promoting an admin to super_admin, demoting one back to admin. The
first version used the browser's `window.confirm()` dialog for these.
A GDS-style review flagged this as inadequate: `confirm()` cannot be
styled to match the rest of the service, gives no room to explain the
consequence of the action, hides what is at stake behind a tiny modal,
and is inconsistent with the GOV.UK "are you sure?" pattern that
government users are used to seeing for any irreversible change.

## Decision

Every destructive admin action is now routed through a dedicated
confirmation page at `/admin/confirm.html?action=<name>&email=<target>`.
The page reads from a small action catalogue in the page's script — each
entry knows the target's name, a heading, a consequence sentence, the
API call to make, and the return URL on success. The page is rendered
with a coloured left border (red for irreversible actions, blue for
reversible ones), a one-sentence consequence explanation, a clearly
labelled destructive button ("Yes, deactivate"), and a plain-text
"Cancel" link styled deliberately not as a button so it does not compete
visually with the primary action. Adding a new destructive action means
adding one entry to the catalogue, not touching the page chrome.

## Consequences

Destructive actions now feel like real decisions, not accidental
clicks. The pattern is consistent across employees and admins and any
future destructive action will inherit it for free. The cost is one
extra page load per destructive action, which is acceptable for the
volume — these actions happen a handful of times a week, not per second.
Future contributors must resist the temptation to "save a click" by
moving back to `confirm()` or to inline modals for any new destructive
operation; the consistency of the pattern is the value. If a new action
needs additional input (e.g. a reason for deactivation), extend the
confirm-page catalogue entry to render a small form, rather than
introducing a second confirmation mechanism.
