// POST /api/admin/logout — invalidates the session and clears the cookie.

import { destroySession, tokenFromReq, buildClearCookie } from "../../server/lib/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const token = tokenFromReq(req);
    await destroySession(token);
    res.setHeader("Set-Cookie", buildClearCookie());
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/logout:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}
