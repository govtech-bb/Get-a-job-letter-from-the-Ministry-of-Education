// HMAC-based letter ID + signature.

import crypto from "node:crypto";

const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function newLetterId() {
  return "MOE-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    crypto.randomBytes(3).toString("hex").toUpperCase();
}

export function signLetterId(id) {
  const key = process.env.LETTER_SIGNING_KEY;
  if (!key) throw new Error("LETTER_SIGNING_KEY is not set");
  return crypto.createHmac("sha256", key).update(id).digest("hex").slice(0, 16);
}

export function verifySignature(id, signature) {
  const expected = signLetterId(id);
  // constant-time compare
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function validUntil() {
  return new Date(Date.now() + TTL_MS).toISOString();
}
