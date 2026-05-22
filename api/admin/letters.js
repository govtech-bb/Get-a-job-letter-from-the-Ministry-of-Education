// GET /api/admin/letters?page=&q=&status= — paginated, search-filtered list of
// issued letters. Admin-only.

import { requireAdmin } from "../../server/lib/adminAuth.js";
import { listIssuedLetters } from "../../server/lib/handlers/adminLetters.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  await requireAdmin(req, res, async () => {
    try {
      const data = await listIssuedLetters({
        page: req.query.page,
        q: req.query.q,
        status: req.query.status,
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("admin/letters:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
