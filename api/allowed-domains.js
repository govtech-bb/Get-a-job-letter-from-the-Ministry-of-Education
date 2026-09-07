// Public read-only endpoint: returns the list of allowed email domains.

import { listAllowedDomains } from "../server/lib/db.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  try {
    const rows = await listAllowedDomains();
    res.status(200).json({ domains: rows });
  } catch (err) {
    console.error("allowed-domains:", err);
    res.status(500).json({ error: "internal_error" });
  }
}
