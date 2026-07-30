// Shared DB helper. Uses @neondatabase/serverless so it works in Vercel's
// serverless runtime (HTTP fetch, no TCP needed) and in Node.

import { neon } from "@neondatabase/serverless";

let _sql = null;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
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
  id, signature, recipientEmail, employeeSnapshot, validUntil
}) {
  const q = sql();
  await q`
    INSERT INTO issued_letters (id, signature, recipient_email, employee_snapshot, valid_until)
    VALUES (${id}, ${signature}, ${recipientEmail}, ${JSON.stringify(employeeSnapshot)}, ${validUntil});
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

export async function findIssuedLetter(id) {
  const q = sql();
  const rows = await q`
    SELECT
      id, signature, recipient_email AS "recipientEmail",
      employee_snapshot AS "employee",
      issued_at AS "issuedAt", valid_until AS "validUntil",
      email_message_id AS "emailMessageId", email_status AS "emailStatus"
    FROM issued_letters
    WHERE id = ${id}
    LIMIT 1;
  `;
  return rows[0] || null;
}
