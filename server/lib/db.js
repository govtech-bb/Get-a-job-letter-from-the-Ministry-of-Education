// Shared DB helper. Uses @neondatabase/serverless for production (Netlify
// serverless, HTTP fetch) and falls back to pg for local development.

import { neon } from "@neondatabase/serverless";
import pg from "pg";

let _sql = null;

function localSql(pool) {
  return async function taggedQuery(strings, ...values) {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) {
      text += `$${i + 1}` + strings[i + 1];
    }
    const { rows } = await pool.query(text, values);
    return rows;
  };
}

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      _sql = localSql(new pg.Pool({ connectionString: url }));
    } else {
      _sql = neon(url);
    }
  }
  return _sql;
}

export async function findEmployeeByEmail(email) {
  const q = sql();
  const rows = await q`
    SELECT
      employee_id AS "employeeId",
      email, title, first_name AS "firstName", last_name AS "lastName",
      pronoun, address, letter_type AS "letterType",
      post, school, employer,
      to_char(appointment_date, 'YYYY-MM-DD') AS "appointmentDate",
      monthly_salary::float8 AS "monthlySalary",
      monthly_allowance::float8 AS "monthlyAllowance",
      pay_frequency AS "payFrequency",
      is_acting AS "isActing",
      is_active AS "isActive"
    FROM employees
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function findEmployeeByEmployeeId(employeeId) {
  const q = sql();
  const rows = await q`
    SELECT
      employee_id AS "employeeId",
      email, title, first_name AS "firstName", last_name AS "lastName",
      pronoun, address, letter_type AS "letterType",
      post, school, employer,
      to_char(appointment_date, 'YYYY-MM-DD') AS "appointmentDate",
      monthly_salary::float8 AS "monthlySalary",
      monthly_allowance::float8 AS "monthlyAllowance",
      pay_frequency AS "payFrequency",
      is_acting AS "isActing",
      is_active AS "isActive"
    FROM employees
    WHERE employee_id = ${employeeId}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function insertIssuedLetter({
  id, signature, documentCode, recipientEmail, employeeSnapshot, validUntil
}) {
  const q = sql();
  await q`
    INSERT INTO issued_letters (id, signature, document_code, recipient_email, employee_snapshot, valid_until)
    VALUES (${id}, ${signature}, ${documentCode || null}, ${recipientEmail}, ${JSON.stringify(employeeSnapshot)}, ${validUntil});
  `;
}

export async function updateLetterEmailStatus(id, messageId, status) {
  const q = sql();
  await q`
    UPDATE issued_letters
    SET email_message_id = ${messageId}, email_status = ${status}
    WHERE id = ${id};
  `;
}

export async function listAllowedDomains() {
  const q = sql();
  try {
    return await q`SELECT domain, added_by AS "addedBy", created_at AS "createdAt" FROM allowed_domains ORDER BY domain;`;
  } catch (err) {
    if (err.code === "42P01") return [];
    throw err;
  }
}

export async function addAllowedDomain(domain, addedBy) {
  const q = sql();
  await q`INSERT INTO allowed_domains (domain, added_by) VALUES (${domain}, ${addedBy}) ON CONFLICT (domain) DO NOTHING;`;
}

export async function removeAllowedDomain(domain) {
  const q = sql();
  await q`DELETE FROM allowed_domains WHERE domain = ${domain};`;
}

export async function findIssuedLetter(id) {
  const q = sql();
  const rows = await q`
    SELECT
      id, signature, document_code AS "documentCode",
      recipient_email AS "recipientEmail",
      employee_snapshot AS "employee",
      issued_at AS "issuedAt", valid_until AS "validUntil",
      email_message_id AS "emailMessageId", email_status AS "emailStatus"
    FROM issued_letters
    WHERE id = ${id}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function insertVerificationAttempt({ letterId, sourceHash, codeSubmitted, result }) {
  const q = sql();
  await q`
    INSERT INTO verification_attempts (letter_id, source_hash, code_submitted, result)
    VALUES (${letterId}, ${sourceHash}, ${codeSubmitted || null}, ${result});
  `;
}

export async function countRecentAttempts(letterId, windowMinutes = 15) {
  const q = sql();
  const rows = await q`
    SELECT COUNT(*)::int AS count
    FROM verification_attempts
    WHERE letter_id = ${letterId}
      AND result = 'fail'
      AND attempted_at > NOW() - INTERVAL '1 minute' * ${windowMinutes};
  `;
  return rows[0]?.count || 0;
}

export async function countRecentSourceAttempts(sourceHash, windowMinutes = 15) {
  const q = sql();
  const rows = await q`
    SELECT COUNT(*)::int AS count
    FROM verification_attempts
    WHERE source_hash = ${sourceHash}
      AND attempted_at > NOW() - INTERVAL '1 minute' * ${windowMinutes};
  `;
  return rows[0]?.count || 0;
}
