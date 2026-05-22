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
      // Deliberately do NOT pass through internal details (e.g. provider
      // error strings). The reason code is enough for the UI to decide
      // what to say; operators see the full error in the server log.
      return res.status(result.status || 400).json({ error: result.reason });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/login:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}
