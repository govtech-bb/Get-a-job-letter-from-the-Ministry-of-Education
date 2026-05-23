# Decision records

This directory holds Architecture Decision Records (ADRs) for the Job Letters
service. Each file captures a non-obvious choice the team has made — the kind
of decision a future maintainer would otherwise have to reverse-engineer from
code or stumble into by accident.

Use this directory whenever you make a call that meets any of these tests:

- A reasonable person could have chosen the other option.
- The reasoning behind the choice isn't visible in the code itself.
- Reversing it would be expensive.
- We hit a bug because we forgot about it once already.

## Format

Each ADR is three short paragraphs, in this order:

1. **Context** — what situation forced the decision; what we knew at the time.
2. **Decision** — the choice we made, in one sentence followed by enough detail
   to be unambiguous.
3. **Consequences** — what this commits us to, what it costs, and the failure
   modes a future reader should watch for.

Files are numbered sequentially (`0001-…`, `0002-…`) and never renumbered.
A decision that is later reversed gets a new ADR that supersedes the old one;
the old file stays in the directory with a `Status: superseded by 00NN` note
at the top, so the history of the thinking remains traceable.

## Index

| #     | Title                                                         | Status   |
|-------|---------------------------------------------------------------|----------|
| 0001  | Magic-link admin authentication                               | Accepted |
| 0002  | Snapshot employee data into issued letters                    | Accepted |
| 0003  | HMAC-signed verification tokens, not session lookups          | Accepted |
| 0004  | Admin sign-in codes bypass `RESEND_OVERRIDE_TO`               | Superseded by 0006 |
| 0005  | Confirmation pages for destructive admin actions              | Accepted |
| 0006  | Override list also copies admin credential emails             | Accepted |
