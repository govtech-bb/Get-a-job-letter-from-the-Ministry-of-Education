// GET /api/admin/me — returns the signed-in admin's profile, or 401.
// Used by the admin frontend to bootstrap state on page load.

import { requireAdmin } from "../../server/lib/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  await requireAdmin(req, res, () => {
    return res.status(200).json({
      email: req.admin.adminEmail,
      name: req.admin.name,
      role: req.admin.role,
    });
  });
}
