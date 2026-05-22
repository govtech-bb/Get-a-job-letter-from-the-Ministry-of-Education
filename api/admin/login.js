// POST /api/admin/login  { email }  →  always returns ok (no enumeration);
// if the email is on the admins allowlist, sends a 6-digit code via Resend.

import { issueCode } from "../../server/lib/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const { email } = req.body || {};
    const result = await issueCode({ email });
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.reason, detail: result.detail });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/login:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}
