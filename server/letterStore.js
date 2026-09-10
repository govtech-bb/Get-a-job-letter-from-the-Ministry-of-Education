// In-memory store of issued letters, with HMAC-based tokens. In production this
// would be a database; the signing key would come from a secret manager and the
// PDF itself would also carry a cryptographic signature.

import crypto from "node:crypto";

const SIGNING_KEY = process.env.LETTER_SIGNING_KEY || "alpha-demo-key-not-for-production";
const LETTER_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const letters = new Map(); // id -> { id, employee, issuedAt, validUntil, token }

function sign(id) {
  return crypto.createHmac("sha256", SIGNING_KEY).update(id).digest("hex").slice(0, 16);
}

export function issueLetter(employee, recipientEmail = null) {
  const id = "MOE-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  const token = sign(id);
  const issuedAt = new Date();
  const validUntil = new Date(issuedAt.getTime() + LETTER_TTL_MS);
  const letter = {
    id,
    token,
    employee: { ...employee },
    recipientEmail,
    issuedAt: issuedAt.toISOString(),
    validUntil: validUntil.toISOString(),
  };
  letters.set(id, letter);
  return letter;
}

export function getLetter(id) {
  return letters.get(id) || null;
}

export function verifyLetter(id, token) {
  const letter = letters.get(id);
  if (!letter) return { valid: false, reason: "We have no record of a letter with that reference." };
  if (letter.token !== token) return { valid: false, reason: "The verification code does not match. This letter may have been altered." };
  return { valid: true, letter };
}
