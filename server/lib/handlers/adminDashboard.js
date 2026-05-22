// Admin dashboard data: aggregate counts, things requiring attention, and
// recent activity.

import { sql } from "../db.js";

export async function adminDashboardData() {
  const q = sql();

  const [counts] = await q`
    SELECT
      (SELECT COUNT(*)::int FROM issued_letters) AS letters_total,
      (SELECT COUNT(*)::int FROM issued_letters WHERE issued_at > NOW() - INTERVAL '24 hours') AS letters_24h,
      (SELECT COUNT(*)::int FROM issued_letters WHERE issued_at > NOW() - INTERVAL '7 days')  AS letters_7d,
      (SELECT COUNT(*)::int FROM issued_letters WHERE email_status = 'sent') AS letters_sent,
      (SELECT COUNT(*)::int FROM issued_letters WHERE email_status LIKE 'failed%') AS letters_failed,
      (SELECT COUNT(*)::int FROM employees WHERE is_active = TRUE) AS employees_active,
      (SELECT COUNT(*)::int FROM employees WHERE is_active = FALSE) AS employees_inactive,
      (SELECT COUNT(*)::int FROM admins WHERE is_active = TRUE) AS admins_active;
  `;

  // Recent failed emails — the actual rows to investigate, not just a count
  const failed = await q`
    SELECT
      id,
      recipient_email AS "recipientEmail",
      employee_snapshot->>'firstName' AS "firstName",
      employee_snapshot->>'lastName'  AS "lastName",
      issued_at AS "issuedAt",
      email_status AS "emailStatus"
    FROM issued_letters
    WHERE email_status LIKE 'failed%'
    ORDER BY issued_at DESC
    LIMIT 5;
  `;

  // Recently edited employees — most recently changed records
  const recentlyEdited = await q`
    SELECT
      email,
      title,
      first_name AS "firstName",
      last_name AS "lastName",
      post,
      school,
      letter_type AS "letterType",
      is_active AS "isActive",
      updated_at AS "updatedAt"
    FROM employees
    ORDER BY updated_at DESC
    LIMIT 5;
  `;

  // Recent issued letters
  const recent = await q`
    SELECT
      id,
      recipient_email AS "recipientEmail",
      employee_snapshot->>'firstName' AS "firstName",
      employee_snapshot->>'lastName'  AS "lastName",
      employee_snapshot->>'letterType' AS "letterType",
      issued_at AS "issuedAt",
      email_status AS "emailStatus"
    FROM issued_letters
    ORDER BY issued_at DESC
    LIMIT 5;
  `;

  return { counts, failed, recentlyEdited, recent };
}
