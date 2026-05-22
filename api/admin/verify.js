// POST /api/admin/verify  { email, code }  →  exchanges the code for a
// session cookie. Returns { ok, admin: { email, name, role } } on success.

import { verifyCode, buildSetCookie } from "../../server/lib/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const { email, code } = req.body || {};
    const result = await verifyCode({
      email,
      code,
      userAgent: req.headers["user-agent"] || null,
    });
    if (!result.ok) {
      return res.status(result.status || 401).json({ error: result.reason });
    }
    res.setHeader("Set-Cookie", buildSetCookie(result.token, result.expiresAt));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/verify:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}
