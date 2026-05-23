# 0003 — HMAC-signed verification tokens, not session lookups

**Status**: Accepted
**Date**: 2026-05

## Context

A job letter carries a verification URL (and matching QR code) that a third
party — a bank, a credit union, a retailer — uses to confirm the letter is
genuine. The third party is not a Ministry employee, will not sign in, and
in many cases will scan the QR while standing at a counter on a phone with
poor connectivity. Two approaches were considered: a short opaque token
that the verifier server looks up in a database, and a self-contained
signed token that the verifier server can validate without any lookup.

## Decision

Each issued letter has an HMAC-SHA256 signature computed over the letter
ID and the relevant employee snapshot fields, using a server-side secret
(`LETTER_HMAC_SECRET`). The signature is embedded in the verification URL
alongside the letter ID and a short cleartext payload (recipient first
name, post, issue date). Verification at `/verify.html?…` re-computes the
HMAC over the URL payload and compares it to the supplied signature —
no database lookup is required to confirm authenticity. The full record
in `issued_letters` is consulted only for the "valid until" check and
for fraud-investigation purposes.

## Consequences

Verification is fast, works without a logged-in user, and remains
verifiable even if the network round-trip to the database is slow.
Letters cannot be revoked without rotating the HMAC secret, which would
invalidate every issued letter — so revocation is not part of the
v1 model. If a letter needs to be repudiated (employee left, was issued
in error), the path is to mark it in `issued_letters` and rely on the
"valid until" field, not on signature invalidation. The secret must be
treated accordingly: it is stored only in environment variables, never
in the repo, and a rotation procedure should exist before this service
issues letters with long validity windows. The cleartext payload in the
URL is by design — it lets a verifier confirm "this signature matches
this name and post" without trusting a server response. Do not embed
sensitive information in the cleartext payload.
