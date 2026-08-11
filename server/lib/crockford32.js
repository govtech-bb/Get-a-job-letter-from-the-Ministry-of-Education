// Crockford Base32 encoding. Encodes raw bytes to the Crockford alphabet
// (0-9 A-H J-K M-N P-T V-Z), 5 bits per character.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

const DECODE_MAP = new Map();
for (let i = 0; i < ALPHABET.length; i++) {
  DECODE_MAP.set(ALPHABET[i], i);
}
DECODE_MAP.set("O", 0);
DECODE_MAP.set("I", 1);
DECODE_MAP.set("L", 1);

export function decode(str) {
  const upper = str.toUpperCase().replace(/[- ]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];

  for (const ch of upper) {
    const v = DECODE_MAP.get(ch);
    if (v === undefined) throw new Error(`Invalid Crockford character: ${ch}`);
    value = (value << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}
