// Serverless wrapper around the verifyLetter handler.

import { verifyLetter } from "../server/lib/handlers/verifyLetter.js";

export const config = { runtime: "nodejs" };

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { id, t: signature } = req.query;
    const sourceIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress;
    const result = await verifyLetter({ id, signature, sourceIp });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("verify-letter failed:", err);
    return res.status(500).json({ valid: false, reason: "internal_error" });
  }
}
