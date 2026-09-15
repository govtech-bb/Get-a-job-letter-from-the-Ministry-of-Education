// The National Identification (ID) number is six digits, a hyphen, then four
// more, and records hold it in that form. People often type it without the
// hyphen, or with spaces, so the input is put into the stored form before the
// lookup rather than failing an exact match.
//
// Only the shape is checked. The first six digits are a date of birth, but the
// synthetic records use 123456-xxxx, which no date check would accept.

export function normaliseNationalId(value) {
  const digits = String(value ?? "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return null;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}
