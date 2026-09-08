// CRUD for the admins allowlist. Writes are gated to the super_admin role.

import { sql } from "../db.js";
import { Resend } from "resend";
import { recipientsForAdminEmail } from "../recipients.js";
import { isEmailFormat } from "../emailFormat.js";

let _resend = null;
function resendClient() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const VALID_ROLES = new Set(["admin", "super_admin"]);

export async function listAdmins() {
  const q = sql();
  return q`
    SELECT email, name, role,
           is_active  AS "isActive",
           created_at AS "createdAt",
           last_login AS "lastLogin"
    FROM admins
    ORDER BY created_at;
  `;
}

export async function getAdmin(email) {
  const q = sql();
  const rows = await q`
    SELECT email, name, role,
           is_active  AS "isActive",
           created_at AS "createdAt",
           last_login AS "lastLogin"
    FROM admins
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function getAdminAudit(email, { limit = 30 } = {}) {
  const q = sql();
  return q`
    SELECT id, action, changed_by AS "changedBy", changed_at AS "changedAt",
           before_data AS "before", after_data AS "after"
    FROM admin_audit
    WHERE LOWER(admin_email) = LOWER(${email})
    ORDER BY changed_at DESC
    LIMIT ${limit};
  `;
}

function validate(input) {
  const errors = [];
  if (!isEmailFormat(input.email)) errors.push({ field: "email", message: "Enter a valid email address." });
  if (!input.name) errors.push({ field: "name", message: "Name is required." });
  if (!VALID_ROLES.has(input.role)) errors.push({ field: "role", message: "Role must be admin or super_admin." });
  return errors;
}

async function recordAudit({ adminEmail, action, changedBy, before, after }) {
  const q = sql();
  await q`
    INSERT INTO admin_audit (admin_email, action, changed_by, before_data, after_data)
    VALUES (${adminEmail}, ${action}, ${changedBy},
            ${before ? JSON.stringify(before) : null},
            ${after  ? JSON.stringify(after)  : null});
  `;
}

async function sendInviteEmail({ email, name, invitedBy }) {
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";
  // The invite has to reach the actual new admin so they know they have
  // access. The RESEND_OVERRIDE_TO list (when set) is joined into the To
  // list (decisions/0006). EMAIL_CC (when set) is added to the CC list for
  // permanent oversight (decisions/0007). Both deduplicated.
  const { to: deliverTo, cc } = recipientsForAdminEmail(email);
  const subject = "You've been added to the Job Letters admin console";

  const greetingName = name ? name.split(" ")[0] : "";
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
  const baseUrl = process.env.PUBLIC_BASE_URL || "https://moe-letters.vercel.app";
  const loginUrl = `${baseUrl}/admin/login.html`;

  const text = `${greeting}

${invitedBy} has added you as an admin on the Ministry of Education Job Letters service.

To sign in:
  1. Open ${loginUrl}
  2. Enter your email (${email}) — we'll send you a 6-digit code.
  3. Enter the code on the next screen.

You'll then have access to the admin dashboard, letters log and employee directory.

If you weren't expecting this, you can ignore the email and your access can be removed.`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px;">
      <p>${greeting}</p>
      <p>${invitedBy} has added you as an admin on the Ministry of Education Job Letters service.</p>
      <p><strong>To sign in:</strong></p>
      <ol>
        <li>Open <a href="${loginUrl}">${loginUrl}</a></li>
        <li>Enter your email (<code>${email}</code>) — we'll send you a 6-digit code.</li>
        <li>Enter the code on the next screen.</li>
      </ol>
      <p>You'll then have access to the admin dashboard, letters log and employee directory.</p>
      <p style="color:#555;font-size:0.9rem;">If you weren't expecting this, you can ignore the email and your access can be removed.</p>
    </div>`;

  try {
    const { error } = await resendClient().emails.send({
      from, to: deliverTo, cc: cc.length ? cc : undefined, subject, text, html,
    });
    if (error) return { ok: false, reason: error.message || JSON.stringify(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function createAdmin({ body, changedBy, isSuperAdmin }) {
  if (!isSuperAdmin) {
    return { status: 403, body: { error: "forbidden", message: "Only super admins can add admins." } };
  }

  const input = {
    email: String(body?.email || "").trim().toLowerCase(),
    name:  String(body?.name  || "").trim(),
    role:  body?.role === "super_admin" ? "super_admin" : "admin",
  };
  const errors = validate(input);
  if (errors.length) return { status: 400, body: { error: "validation", errors } };

  const q = sql();
  const exists = await q`SELECT email FROM admins WHERE LOWER(email) = ${input.email} LIMIT 1;`;
  if (exists[0]) {
    return { status: 409, body: { error: "conflict", message: "An admin with that email already exists." } };
  }

  await q`
    INSERT INTO admins (email, name, role)
    VALUES (${input.email}, ${input.name}, ${input.role});
  `;
  await recordAudit({ adminEmail: input.email, action: "invite", changedBy, before: null, after: input });

  // Best-effort invite email. If it fails we still return success — the new
  // admin can sign in any time. The failure reason is returned for visibility.
  const email = await sendInviteEmail({ email: input.email, name: input.name, invitedBy: changedBy });

  const created = await getAdmin(input.email);
  return {
    status: 201,
    body: { admin: created, emailSent: email.ok, emailError: email.ok ? null : email.reason },
  };
}

export async function updateAdmin({ email, body, changedBy, isSuperAdmin }) {
  if (!isSuperAdmin) {
    return { status: 403, body: { error: "forbidden", message: "Only super admins can change admins." } };
  }

  const norm = String(email || "").trim().toLowerCase();
  if (norm === String(changedBy).toLowerCase()) {
    return {
      status: 400,
      body: {
        error: "self_modify",
        message: "You can't change your own role or status. Ask another super admin.",
      },
    };
  }

  const before = await getAdmin(norm);
  if (!before) return { status: 404, body: { error: "not_found" } };

  const next = {
    email: before.email,
    name:  body?.name != null ? String(body.name).trim() : before.name,
    role:  VALID_ROLES.has(body?.role) ? body.role : before.role,
    isActive: body?.isActive == null ? before.isActive : !!body.isActive,
  };
  const errors = validate(next);
  if (errors.length) return { status: 400, body: { error: "validation", errors } };

  // If the last active super_admin would be deactivated or demoted, refuse.
  if ((before.role === "super_admin" && next.role !== "super_admin") ||
      (before.isActive === true && next.isActive === false && before.role === "super_admin")) {
    const q = sql();
    const [{ n }] = await q`SELECT COUNT(*)::int AS n FROM admins WHERE role = 'super_admin' AND is_active = TRUE;`;
    if (n <= 1) {
      return {
        status: 400,
        body: { error: "last_super_admin", message: "This is the only active super admin. Add another super admin first." },
      };
    }
  }

  const q = sql();
  await q`
    UPDATE admins SET name = ${next.name}, role = ${next.role}, is_active = ${next.isActive}
    WHERE LOWER(email) = ${norm};
  `;
  const action =
    before.isActive && !next.isActive ? "deactivate" :
    !before.isActive && next.isActive ? "reactivate" :
    "update";
  const after = await getAdmin(norm);
  await recordAudit({ adminEmail: norm, action, changedBy, before, after });

  return { status: 200, body: { admin: after } };
}
