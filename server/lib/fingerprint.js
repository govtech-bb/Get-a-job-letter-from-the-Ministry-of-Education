// Document fingerprint: HMAC-SHA256 over the canonical employee snapshot,
// truncated to 5 bytes and encoded as 8 Crockford base32 characters.
// A version character is prepended to identify which key was used.
//
// Full document code format: VXXXXXXXX (9 raw chars)
// Display format: V-XXXX-XXXX

import crypto from "node:crypto";
import { encode as crockford32Encode } from "./crockford32.js";
import { canonicalise } from "./canonicalise.js";

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const FINGERPRINT_BYTES = 5; // 40 bits → 8 Crockford chars

let _keys = null;

function loadKeys() {
  if (_keys) return _keys;
  _keys = new Map();
  for (const [envKey, envVal] of Object.entries(process.env)) {
    const match = envKey.match(/^FINGERPRINT_KEY_V(\d+)$/);
    if (match && envVal) {
      const version = parseInt(match[1], 10);
      if (version >= 0 && version < 32) {
        _keys.set(version, envVal);
      }
    }
  }
  if (_keys.size === 0) {
    throw new Error("No FINGERPRINT_KEY_V* environment variables are set");
  }
  return _keys;
}

function currentVersion() {
  const keys = loadKeys();
  return Math.max(...keys.keys());
}

function keyForVersion(version) {
  const keys = loadKeys();
  const key = keys.get(version);
  if (!key) throw new Error(`No key for fingerprint version ${version}`);
  return key;
}

function versionChar(version) {
  return CROCKFORD_ALPHABET[version];
}

function versionFromChar(ch) {
  const idx = CROCKFORD_ALPHABET.indexOf(ch.toUpperCase());
  if (idx === -1) throw new Error(`Invalid version character: ${ch}`);
  return idx;
}

export function generateDocumentCode(employee) {
  const version = currentVersion();
  const key = keyForVersion(version);
  const canonical = canonicalise(employee);
  const hmac = crypto.createHmac("sha256", key).update(canonical).digest();
  const truncated = hmac.subarray(0, FINGERPRINT_BYTES);
  const encoded = crockford32Encode(truncated);
  return versionChar(version) + encoded;
}

export function verifyDocumentCode(employee, code) {
  const normalised = code.toUpperCase().replace(/[- ]/g, "");
  if (normalised.length !== 9) return false;
  const version = versionFromChar(normalised[0]);
  let key;
  try {
    key = keyForVersion(version);
  } catch {
    return false;
  }
  const canonical = canonicalise(employee);
  const hmac = crypto.createHmac("sha256", key).update(canonical).digest();
  const truncated = hmac.subarray(0, FINGERPRINT_BYTES);
  const expected = versionChar(version) + crockford32Encode(truncated);
  if (expected.length !== normalised.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalised));
}

export function formatDocumentCode(code) {
  const raw = code.replace(/[- ]/g, "");
  return raw[0] + "-" + raw.slice(1, 5) + "-" + raw.slice(5, 9);
}

export function resetKeyCache() {
  _keys = null;
}
