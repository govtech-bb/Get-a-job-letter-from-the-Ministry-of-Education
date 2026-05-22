// /api/admin/admins
//   GET                       → list admins
//   GET   ?email=X            → fetch one
//   GET   ?email=X&audit=1    → audit history for one
//   POST                      → create (super_admin only)
//   PUT   ?email=X            → update (super_admin only)

import { requireAdmin } from "../../server/lib/adminAuth.js";
import {
  listAdmins, getAdmin, getAdminAudit, createAdmin, updateAdmin,
} from "../../server/lib/handlers/adminAdmins.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  await requireAdmin(req, res, async () => {
    try {
      const { email, audit } = req.query;
      const changedBy = req.admin.adminEmail;
      const isSuperAdmin = req.admin.role === "super_admin";

      if (req.method === "POST" && !email) {
        const r = await createAdmin({ body: req.body, changedBy, isSuperAdmin });
        return res.status(r.status).json(r.body);
      }
      if (req.method === "PUT" && email) {
        const r = await updateAdmin({ email, body: req.body, changedBy, isSuperAdmin });
        return res.status(r.status).json(r.body);
      }
      if (req.method === "GET" && email && audit) {
        const rows = await getAdminAudit(email);
        return res.status(200).json({ audit: rows });
      }
      if (req.method === "GET" && email) {
        const a = await getAdmin(email);
        if (!a) return res.status(404).json({ error: "not_found" });
        return res.status(200).json({ admin: a });
      }
      if (req.method === "GET") {
        const admins = await listAdmins();
        return res.status(200).json({ admins });
      }
      res.status(405).json({ error: "method_not_allowed" });
    } catch (err) {
      console.error("admin/admins:", err);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });
}
