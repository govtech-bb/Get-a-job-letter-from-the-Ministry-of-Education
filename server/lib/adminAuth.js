// Admin auth — magic-link by email + 6-digit code.
//
// Flow:
//   1) POST /api/admin/login   { email }       → issueCode  (sends Resend email)
//   2) POST /api/admin/verify  { email, code } → consumeCode + createSession + Set-Cookie
//   3) POST /api/admin/logout                  → destroySession + clear cookie
//
// Sessions live in admin_sessions. The bearer token sent in the cookie is the
// session row PK; we look it up + check expires_at on each request.

import crypto from "node:crypto";
import { sql } from "./db.js";
import { Resend } from "resend";
import { recipientsForAdminEmail } from "./recipients.js";

const CODE_TTL_MIN = 10;
const SESSION_TTL_HOURS = 8;
const MAX_CODE_ATTEMPTS = 5;
const COOKIE_NAME = "moe_admin_session";

let _resend = null;
function resendClient() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function randomCode() {
  // 6 digits, leading zeros allowed
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function nowPlus(ms) {
  return new Date(Date.now() + ms).toISOString();
}

/* ---------- step 1: issue code ---------- */

export async function issueCode({ email }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { ok: false, status: 400, reason: "invalid_email" };

  const q = sql();
  const rows = await q`
    SELECT email, name, is_active FROM admins
    WHERE LOWER(email) = ${normalized} LIMIT 1;
  `;
  // We always return ok=true so attackers can't enumerate admin emails.
  // Only actually send the code if the address is on the allowlist.
  const admin = rows[0];
  if (!admin || !admin.is_active) {
    return { ok: true, sent: false };
  }

  const code = randomCode();
  const id = crypto.randomBytes(16).toString("hex");
  const expiresAt = nowPlus(CODE_TTL_MIN * 60 * 1000);
  await q`
    INSERT INTO admin_codes (id, email, code_hash, expires_at)
    VALUES (${id}, ${admin.email}, ${hashCode(code)}, ${expiresAt});
  `;

  try {
    await sendCodeEmail({ to: admin.email, name: admin.name, code });
    return { ok: true, sent: true };
  } catch (err) {
    // Log the underlying provider error for operators (server log /
    // Vercel function log) but never surface it to the browser — it's
    // an implementation detail that confuses end users and can leak
    // information about our infrastructure.
    console.error("adminAuth.issueCode: email send failed for", admin.email, "—", err.message || err);
    return {
      ok: false,
      status: 502,
      reason: "email_send_failed",
    };
  }
}

async function sendCodeEmail({ to, name, code }) {
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";
  // Admin sign-in codes are a credential — they must reach the actual admin.
  // The RESEND_OVERRIDE_TO list (when set) is joined into the To list so the
  // test cohort can observe credential emails (decisions/0006). EMAIL_CC
  // (when set) is added to the CC list for permanent oversight
  // (decisions/0007). Both deduplicated against the To list.
  const { to: deliverTo, cc } = recipientsForAdminEmail(to);
  const subject = "Your Job Letters admin sign-in code";

  const greeting = name ? `Hello ${name.split(" ")[0]},` : "Hello,";

  const text = `${greeting}

Your sign-in code for the Job Letters admin console is:

   ${code}

It expires in ${CODE_TTL_MIN} minutes. If you didn't request this, ignore the email.`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:480px;">
      <p>${greeting}</p>
      <p>Your sign-in code for the Job Letters admin console is:</p>
      <p style="font-family:ui-monospace,Consolas,monospace;font-size:28px;letter-spacing:0.18em;background:#f3f4f6;padding:14px 20px;display:inline-block;border-radius:6px;color:#0e5f64;">${code}</p>
      <p style="color:#555;">It expires in ${CODE_TTL_MIN} minutes. If you didn't request this, ignore the email.</p>
    </div>`;

  const { error } = await resendClient().emails.send({
    from, to: deliverTo, cc: cc.length ? cc : undefined, subject, text, html,
  });
  if (error) throw new Error("Resend send failed: " + (error.message || JSON.stringify(error)));
}

/* ---------- step 2: verify code, issue session ---------- */

export async function verifyCode({ email, code, userAgent }) {
  const normalized = String(email || "").trim().toLowerCase();
  const codeClean = String(code || "").trim();
  if (!normalized || !/^\d{6}$/.test(codeClean)) {
    return { ok: false, status: 400, reason: "invalid_input" };
  }

  const q = sql();

  // Find latest unconsumed, unexpired code for this email
  const codes = await q`
    SELECT id, code_hash, attempts FROM admin_codes
    WHERE LOWER(email) = ${normalized}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const row = codes[0];
  if (!row) {
    return { ok: false, status: 401, reason: "no_active_code" };
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, status: 429, reason: "too_many_attempts" };
  }
  if (row.code_hash !== hashCode(codeClean)) {
    await q`UPDATE admin_codes SET attempts = attempts + 1 WHERE id = ${row.id};`;
    return { ok: false, status: 401, reason: "bad_code" };
  }

  // Mark the code consumed
  await q`UPDATE admin_codes SET consumed_at = NOW() WHERE id = ${row.id};`;

  // Issue session
  const token = randomToken();
  const expiresAt = nowPlus(SESSION_TTL_HOURS * 60 * 60 * 1000);
  await q`
    INSERT INTO admin_sessions (token, admin_email, expires_at, user_agent)
    VALUES (${token}, ${normalized}, ${expiresAt}, ${userAgent || null});
  `;
  await q`UPDATE admins SET last_login = NOW() WHERE LOWER(email) = ${normalized};`;

  return { ok: true, token, expiresAt };
}

/* ---------- session validation (middleware) ---------- */

export async function findSession(token) {
  if (!token) return null;
  const q = sql();
  const rows = await q`
    SELECT s.token, s.admin_email AS "adminEmail", s.expires_at AS "expiresAt",
           a.name, a.role, a.is_active AS "isActive"
    FROM admin_sessions s
    JOIN admins a ON LOWER(a.email) = LOWER(s.admin_email)
    WHERE s.token = ${token}
      AND s.expires_at > NOW()
      AND a.is_active = TRUE
    LIMIT 1;
  `;
  if (!rows[0]) return null;
  await q`UPDATE admin_sessions SET last_seen_at = NOW() WHERE token = ${token};`;
  return rows[0];
}

export async function destroySession(token) {
  if (!token) return;
  const q = sql();
  await q`DELETE FROM admin_sessions WHERE token = ${token};`;
}

/* ---------- cookie helpers ---------- */

// Netlify sets NETLIFY=true in the function runtime but does not necessarily
// set NODE_ENV=production, so without this the session cookie would be issued
// without Secure on the Netlify deploy.
function isProduction() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.NETLIFY === "true"
  );
}

export function cookieName() {
  return COOKIE_NAME;
}

export function buildSetCookie(token, expiresAt) {
  const expires = new Date(expiresAt).toUTCString();
  const isProd = isProduction();
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expires}`,
    isProd ? "Secure" : null,
  ].filter(Boolean).join("; ");
}

export function buildClearCookie() {
  const isProd = isProduction();
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    isProd ? "Secure" : null,
  ].filter(Boolean).join("; ");
}

export function parseCookie(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(/;\s*/).map(p => {
      const i = p.indexOf("=");
      if (i < 0) return [p, ""];
      return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    })
  );
}

export function tokenFromReq(req) {
  const cookieHeader = req.headers?.cookie || req.headers?.Cookie || "";
  const cookies = parseCookie(cookieHeader);
  return cookies[COOKIE_NAME] || null;
}

// Express-style middleware: call before any admin endpoint to ensure
// req.admin is populated, otherwise 401.
export async function requireAdmin(req, res, next) {
  try {
    const session = await findSession(tokenFromReq(req));
    if (!session) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    req.admin = session;
    if (next) next();
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: err.message });
  }
}
