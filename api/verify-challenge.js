// Vercel serverless wrapper: document fingerprint challenge verification.

import { challengeLetter } from "../server/lib/handlers/verifyLetter.js";

export const config = { runtime: "nodejs" };

const ALLOWED_ORIGINS = new Set([
  "https://govtech-bb.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { id, t: signature, code } = req.body || {};
    const sourceIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress;
    const result = await challengeLetter({ id, signature, code, sourceIp });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("verify-challenge failed:", err);
    return res.status(500).json({ valid: false, reason: "internal_error" });
  }
}
