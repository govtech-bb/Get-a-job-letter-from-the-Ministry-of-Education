// POST /api/admin/employees/upload-apply — apply a previously previewed CSV.
// super_admin only. Mirrors the route in server/index.js.

import { requireAdmin } from "../../server/lib/adminAuth.js";
import { applyUpload } from "../../server/lib/handlers/adminUpload.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  await requireAdmin(req, res, async () => {
    try {
      if (req.admin.role !== "super_admin") return res.status(403).json({ error: "forbidden" });
      const csv = req.body?.csv;
      if (!csv) return res.status(400).json({ error: "No CSV data provided." });
      const result = await applyUpload(csv, req.admin.adminEmail);
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error("admin/upload-apply:", err);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });
}
