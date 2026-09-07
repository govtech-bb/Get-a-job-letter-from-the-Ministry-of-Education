// /api/admin/settings/domains
//   GET    → list allowed domains
//   POST   → add a domain (super_admin only)
//   DELETE → remove a domain (super_admin only)

import { requireAdmin } from "../../server/lib/adminAuth.js";
import { getDomains, addDomain, deleteDomain } from "../../server/lib/handlers/adminSettings.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  await requireAdmin(req, res, async () => {
    try {
      const changedBy = req.admin.adminEmail;
      const isSuperAdmin = req.admin.role === "super_admin";

      if (req.method === "GET") {
        const r = await getDomains();
        return res.status(r.status).json(r.body);
      }
      if (req.method === "POST") {
        const r = await addDomain({ domain: req.body?.domain, changedBy, isSuperAdmin });
        return res.status(r.status).json(r.body);
      }
      if (req.method === "DELETE") {
        const r = await deleteDomain({ domain: req.query?.domain, changedBy, isSuperAdmin });
        return res.status(r.status).json(r.body);
      }
      res.status(405).json({ error: "method_not_allowed" });
    } catch (err) {
      console.error("admin/settings/domains:", err);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });
}
