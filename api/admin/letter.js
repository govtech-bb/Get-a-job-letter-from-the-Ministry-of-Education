// GET /api/admin/letter?id=MOE-XXX — single issued-letter detail including the
// full employee snapshot.

import { requireAdmin } from "../../server/lib/adminAuth.js";
import { getIssuedLetterDetail } from "../../server/lib/handlers/adminLetters.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  await requireAdmin(req, res, async () => {
    try {
      const id = String(req.query.id || "");
      if (!id) return res.status(400).json({ error: "missing_id" });
      const letter = await getIssuedLetterDetail(id);
      if (!letter) return res.status(404).json({ error: "not_found" });
      res.status(200).json({ letter });
    } catch (err) {
      console.error("admin/letter:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
