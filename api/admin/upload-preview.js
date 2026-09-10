// POST /api/admin/employees/upload-preview — validate a CSV and report what an
// apply would change. super_admin only. Mirrors the route in server/index.js.

import { requireAdmin } from "../../server/lib/adminAuth.js";
import { previewUpload } from "../../server/lib/handlers/adminUpload.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  await requireAdmin(req, res, async () => {
    try {
      if (req.admin.role !== "super_admin") return res.status(403).json({ error: "forbidden" });
      const csv = req.body?.csv;
      if (!csv) return res.status(400).json({ error: "No CSV data provided." });
      const result = await previewUpload(csv);
      if (result.error && result.error !== "validation") return res.status(400).json(result);
      if (result.error === "validation") return res.status(422).json(result);
      res.status(200).json(result);
    } catch (err) {
      console.error("admin/upload-preview:", err);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });
}
