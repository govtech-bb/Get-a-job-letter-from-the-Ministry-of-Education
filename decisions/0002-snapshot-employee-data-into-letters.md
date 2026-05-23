# 0002 — Snapshot employee data into issued letters

**Status**: Accepted
**Date**: 2026-05

## Context

A job letter is a statement about an employee's role, post, salary and
employer **at the moment it was issued**. The underlying employee record
will change over time — people are promoted, moved, given allowances, or
deactivated. If a letter referred to the employee record by foreign key,
opening a letter issued six months ago would render today's facts under
today's date, which would silently produce a false document. Worse,
re-issuing the same letter URL later would return different content,
defeating the verification model.

## Decision

The `issued_letters` table stores a full snapshot of the employee record
as it stood at the moment of issue, in the `employee_snapshot` JSONB
column. The snapshot is the source of truth for that letter for the rest
of its life. The employee's row in the `employees` table can change freely
afterwards and historical letters are unaffected. The admin UI for a
single letter (`/admin/letter.html`) renders from the snapshot, with a
note that "current values may now differ" and a link back to the live
employee record.

## Consequences

Letter content is permanently reproducible and verifiable against the
HMAC signature stored alongside it (see ADR 0003). The cost is some data
duplication and the risk of confusion if a maintainer thinks they can
"fix" a letter by editing the employee record — they cannot, and they
should not try; once a letter has been issued it is, by design, immutable
from the data model's perspective. If a letter was issued with incorrect
data, the correct response is to issue a replacement letter referencing
the corrected employee record, and to mark the original as superseded in
a future audit field if needed. The `employee_snapshot` JSONB shape is
not currently versioned; if the snapshot fields change shape in a
breaking way, add a `schema_version` key to new snapshots rather than
backfilling old ones.
