// GET /api/admin/dashboard — aggregate stats and 10 most recent letters.

import { requireAdmin } from "../../server/lib/adminAuth.js";
import { adminDashboardData } from "../../server/lib/handlers/adminDashboard.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  await requireAdmin(req, res, async () => {
    try {
      const data = await adminDashboardData();
      res.status(200).json(data);
    } catch (err) {
      console.error("admin/dashboard:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
