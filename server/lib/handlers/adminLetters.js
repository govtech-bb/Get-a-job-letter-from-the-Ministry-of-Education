// Read-only listings of issued letters for the admin side.

import { sql } from "../db.js";

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function listIssuedLetters({ page = 1, q = "", status = "" } = {}) {
  const sqlq = sql();
  const offset = Math.max(0, (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE);

  // Build search/filter. Search hits recipient_email + the snapshotted name +
  // the letter id. Status filter matches the email_status column ("sent",
  // anything starting with "failed", "pending", etc.).
  const search = `%${String(q || "").trim().toLowerCase()}%`;
  const hasSearch = String(q || "").trim().length > 0;
  const hasStatusFilter = String(status || "").length > 0;
  const wantFailed = status === "failed";

  // We use one filter block; Neon's serverless driver doesn't support
  // dynamic identifier interpolation, so we branch via tagged literals.
  const where = [];
  let rows, total;
  if (hasSearch && hasStatusFilter) {
    if (wantFailed) {
      rows = await sqlq`
        SELECT id, recipient_email AS "recipientEmail",
               employee_snapshot->>'firstName' AS "firstName",
               employee_snapshot->>'lastName'  AS "lastName",
               employee_snapshot->>'letterType' AS "letterType",
               employee_snapshot->>'post'       AS "post",
               issued_at AS "issuedAt", email_status AS "emailStatus",
               email_message_id AS "emailMessageId"
        FROM issued_letters
        WHERE (LOWER(recipient_email) LIKE ${search}
            OR LOWER(employee_snapshot->>'firstName') LIKE ${search}
            OR LOWER(employee_snapshot->>'lastName')  LIKE ${search}
            OR LOWER(id) LIKE ${search})
          AND email_status LIKE 'failed%'
        ORDER BY issued_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
      const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM issued_letters
        WHERE (LOWER(recipient_email) LIKE ${search}
            OR LOWER(employee_snapshot->>'firstName') LIKE ${search}
            OR LOWER(employee_snapshot->>'lastName')  LIKE ${search}
            OR LOWER(id) LIKE ${search})
          AND email_status LIKE 'failed%';`;
      total = c.n;
    } else {
      rows = await sqlq`
        SELECT id, recipient_email AS "recipientEmail",
               employee_snapshot->>'firstName' AS "firstName",
               employee_snapshot->>'lastName'  AS "lastName",
               employee_snapshot->>'letterType' AS "letterType",
               employee_snapshot->>'post'       AS "post",
               issued_at AS "issuedAt", email_status AS "emailStatus",
               email_message_id AS "emailMessageId"
        FROM issued_letters
        WHERE (LOWER(recipient_email) LIKE ${search}
            OR LOWER(employee_snapshot->>'firstName') LIKE ${search}
            OR LOWER(employee_snapshot->>'lastName')  LIKE ${search}
            OR LOWER(id) LIKE ${search})
          AND email_status = ${status}
        ORDER BY issued_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
      const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM issued_letters
        WHERE (LOWER(recipient_email) LIKE ${search}
            OR LOWER(employee_snapshot->>'firstName') LIKE ${search}
            OR LOWER(employee_snapshot->>'lastName')  LIKE ${search}
            OR LOWER(id) LIKE ${search})
          AND email_status = ${status};`;
      total = c.n;
    }
  } else if (hasSearch) {
    rows = await sqlq`
      SELECT id, recipient_email AS "recipientEmail",
             employee_snapshot->>'firstName' AS "firstName",
             employee_snapshot->>'lastName'  AS "lastName",
             employee_snapshot->>'letterType' AS "letterType",
             employee_snapshot->>'post'       AS "post",
             issued_at AS "issuedAt", email_status AS "emailStatus",
             email_message_id AS "emailMessageId"
      FROM issued_letters
      WHERE LOWER(recipient_email) LIKE ${search}
         OR LOWER(employee_snapshot->>'firstName') LIKE ${search}
         OR LOWER(employee_snapshot->>'lastName')  LIKE ${search}
         OR LOWER(id) LIKE ${search}
      ORDER BY issued_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
    const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM issued_letters
      WHERE LOWER(recipient_email) LIKE ${search}
         OR LOWER(employee_snapshot->>'firstName') LIKE ${search}
         OR LOWER(employee_snapshot->>'lastName')  LIKE ${search}
         OR LOWER(id) LIKE ${search};`;
    total = c.n;
  } else if (hasStatusFilter) {
    if (wantFailed) {
      rows = await sqlq`
        SELECT id, recipient_email AS "recipientEmail",
               employee_snapshot->>'firstName' AS "firstName",
               employee_snapshot->>'lastName'  AS "lastName",
               employee_snapshot->>'letterType' AS "letterType",
               employee_snapshot->>'post'       AS "post",
               issued_at AS "issuedAt", email_status AS "emailStatus",
               email_message_id AS "emailMessageId"
        FROM issued_letters
        WHERE email_status LIKE 'failed%'
        ORDER BY issued_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
      const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM issued_letters
        WHERE email_status LIKE 'failed%';`;
      total = c.n;
    } else {
      rows = await sqlq`
        SELECT id, recipient_email AS "recipientEmail",
               employee_snapshot->>'firstName' AS "firstName",
               employee_snapshot->>'lastName'  AS "lastName",
               employee_snapshot->>'letterType' AS "letterType",
               employee_snapshot->>'post'       AS "post",
               issued_at AS "issuedAt", email_status AS "emailStatus",
               email_message_id AS "emailMessageId"
        FROM issued_letters
        WHERE email_status = ${status}
        ORDER BY issued_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
      const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM issued_letters WHERE email_status = ${status};`;
      total = c.n;
    }
  } else {
    rows = await sqlq`
      SELECT id, recipient_email AS "recipientEmail",
             employee_snapshot->>'firstName' AS "firstName",
             employee_snapshot->>'lastName'  AS "lastName",
             employee_snapshot->>'letterType' AS "letterType",
             employee_snapshot->>'post'       AS "post",
             issued_at AS "issuedAt", email_status AS "emailStatus",
             email_message_id AS "emailMessageId"
      FROM issued_letters
      ORDER BY issued_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
    const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM issued_letters;`;
    total = c.n;
  }

  return { rows, total, pageSize: PAGE_SIZE, page: Math.max(1, Number(page) || 1) };
}

export async function getIssuedLetterDetail(id) {
  const q = sql();
  const rows = await q`
    SELECT id, signature, recipient_email AS "recipientEmail",
           employee_snapshot AS "employee",
           issued_at AS "issuedAt", valid_until AS "validUntil",
           email_message_id AS "emailMessageId",
           email_status AS "emailStatus"
    FROM issued_letters
    WHERE id = ${id}
    LIMIT 1;
  `;
  return rows[0] || null;
}
