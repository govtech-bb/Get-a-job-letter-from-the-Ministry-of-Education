// Vercel serverless wrapper around the requestLetter handler.

import { requestLetter } from "../server/lib/handlers/requestLetter.js";

export const config = { runtime: "nodejs" };

const ALLOWED_ORIGINS = new Set([
  // GitHub Pages
  "https://govtech-bb.github.io",
  // Local dev
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
    const { firstName, lastName, employeeId, email, publicBaseUrl } = req.body || {};
    const baseUrl = publicBaseUrl ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const result = await requestLetter({ firstName, lastName, employeeId, email, publicBaseUrl: baseUrl });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("request-letter failed:", err);
    return res.status(500).json({ error: "internal_error", message: err.message });
  }
}
