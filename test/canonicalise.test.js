import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalise } from "../server/lib/canonicalise.js";
import { encode, decode } from "../server/lib/crockford32.js";
import {
  generateDocumentCode,
  verifyDocumentCode,
  formatDocumentCode,
  resetKeyCache,
} from "../server/lib/fingerprint.js";

describe("canonicalise", () => {
  const employee = {
    title: "Ms.",
    firstName: "Alexcia",
    lastName: "Taitt-Hope",
    pronoun: "she",
    address: null,
    letterType: "teacher_appointed",
    post: "Graduate Teacher",
    school: "Alleyne School",
    employer: "Ministry of Education Transformation",
    appointmentDate: "2019-09-01",
    monthlySalary: 5965.60,
    monthlyAllowance: null,
    payFrequency: "monthly",
  };

  it("produces a deterministic pipe-separated string", () => {
    const result = canonicalise(employee);
    assert.equal(
      result,
      "ms.|alexcia|taitt-hope|she||teacher_appointed|graduate teacher|alleyne school|ministry of education transformation|2019-09-01|596560|0|monthly"
    );
  });

  it("is identical for the same input called twice", () => {
    assert.equal(canonicalise(employee), canonicalise(employee));
  });

  it("normalises extra whitespace", () => {
    const e = { ...employee, post: "  Graduate   Teacher  " };
    const result = canonicalise(e);
    assert.ok(result.includes("|graduate teacher|"));
  });

  it("normalises unicode (NFKC)", () => {
    const e = { ...employee, firstName: "Alxcía" };
    const result = canonicalise(e);
    assert.ok(result.includes("|alxcía|"));
  });

  it("represents null fields as empty string", () => {
    const result = canonicalise(employee);
    const parts = result.split("|");
    assert.equal(parts[4], "", "address should be empty string");
  });

  it("formats money as integer cents", () => {
    const result = canonicalise(employee);
    const parts = result.split("|");
    assert.equal(parts[10], "596560", "monthlySalary should be 596560 cents");
    assert.equal(parts[11], "0", "null monthlyAllowance should be 0");
  });

  it("formats dates as YYYY-MM-DD", () => {
    const result = canonicalise(employee);
    const parts = result.split("|");
    assert.equal(parts[9], "2019-09-01");
  });

  it("changes output when any field changes", () => {
    const original = canonicalise(employee);
    const changed = canonicalise({ ...employee, monthlySalary: 5965.61 });
    assert.notEqual(original, changed);
  });

  it("includes all 13 fields", () => {
    const result = canonicalise(employee);
    const parts = result.split("|");
    assert.equal(parts.length, 13);
  });
});

describe("crockford32", () => {
  it("encodes known bytes", () => {
    const result = encode(Buffer.from([0xff, 0xff]));
    assert.equal(result, "ZZZG");
  });

  it("encodes zero bytes", () => {
    assert.equal(encode(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00])), "00000000");
  });

  it("round-trips through encode/decode", () => {
    const input = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x42]);
    const encoded = encode(input);
    const decoded = decode(encoded);
    assert.deepEqual(decoded, input);
  });

  it("decode tolerates lowercase and dashes", () => {
    const input = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x42]);
    const encoded = encode(input);
    const lower = encoded.toLowerCase();
    const dashed = lower.slice(0, 4) + "-" + lower.slice(4);
    assert.deepEqual(decode(dashed), input);
  });
});

describe("fingerprint", () => {
  const employee = {
    title: "Ms.",
    firstName: "Alexcia",
    lastName: "Taitt-Hope",
    pronoun: "she",
    address: null,
    letterType: "teacher_appointed",
    post: "Graduate Teacher",
    school: "Alleyne School",
    employer: "Ministry of Education Transformation",
    appointmentDate: "2019-09-01",
    monthlySalary: 5965.60,
    monthlyAllowance: null,
    payFrequency: "monthly",
  };

  it("generates a 9-character document code", () => {
    process.env.FINGERPRINT_KEY_V0 = "test-key-for-unit-tests";
    resetKeyCache();
    const code = generateDocumentCode(employee);
    assert.equal(code.length, 9);
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("first character is the version char", () => {
    process.env.FINGERPRINT_KEY_V0 = "test-key-for-unit-tests";
    resetKeyCache();
    const code = generateDocumentCode(employee);
    assert.equal(code[0], "0", "version 0 maps to character '0'");
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("is deterministic for the same input and key", () => {
    process.env.FINGERPRINT_KEY_V0 = "test-key-for-unit-tests";
    resetKeyCache();
    const a = generateDocumentCode(employee);
    resetKeyCache();
    const b = generateDocumentCode(employee);
    assert.equal(a, b);
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("changes when employee data changes", () => {
    process.env.FINGERPRINT_KEY_V0 = "test-key-for-unit-tests";
    resetKeyCache();
    const original = generateDocumentCode(employee);
    const changed = generateDocumentCode({ ...employee, monthlySalary: 6000 });
    assert.notEqual(original, changed);
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("changes when the key changes", () => {
    process.env.FINGERPRINT_KEY_V0 = "key-a";
    resetKeyCache();
    const a = generateDocumentCode(employee);
    process.env.FINGERPRINT_KEY_V0 = "key-b";
    resetKeyCache();
    const b = generateDocumentCode(employee);
    assert.notEqual(a, b);
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("uses the highest version key", () => {
    process.env.FINGERPRINT_KEY_V0 = "old-key";
    process.env.FINGERPRINT_KEY_V2 = "new-key";
    resetKeyCache();
    const code = generateDocumentCode(employee);
    assert.equal(code[0], "2", "should use version 2");
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
    delete process.env.FINGERPRINT_KEY_V2;
  });

  it("verifyDocumentCode returns true for a valid code", () => {
    process.env.FINGERPRINT_KEY_V0 = "test-key-for-unit-tests";
    resetKeyCache();
    const code = generateDocumentCode(employee);
    const valid = verifyDocumentCode(employee, code);
    assert.equal(valid, true);
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("verifyDocumentCode returns false for wrong data", () => {
    process.env.FINGERPRINT_KEY_V0 = "test-key-for-unit-tests";
    resetKeyCache();
    const code = generateDocumentCode(employee);
    const valid = verifyDocumentCode({ ...employee, monthlySalary: 9999 }, code);
    assert.equal(valid, false);
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("verifyDocumentCode tolerates formatted input", () => {
    process.env.FINGERPRINT_KEY_V0 = "test-key-for-unit-tests";
    resetKeyCache();
    const code = generateDocumentCode(employee);
    const formatted = formatDocumentCode(code);
    const valid = verifyDocumentCode(employee, formatted);
    assert.equal(valid, true);
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
  });

  it("verifyDocumentCode works with old keys after rotation", () => {
    process.env.FINGERPRINT_KEY_V0 = "old-key";
    resetKeyCache();
    const oldCode = generateDocumentCode(employee);
    process.env.FINGERPRINT_KEY_V1 = "new-key";
    resetKeyCache();
    const valid = verifyDocumentCode(employee, oldCode);
    assert.equal(valid, true, "old code should still verify with old key present");
    resetKeyCache();
    delete process.env.FINGERPRINT_KEY_V0;
    delete process.env.FINGERPRINT_KEY_V1;
  });
});

describe("formatDocumentCode", () => {
  it("formats as V-XXXX-XXXX", () => {
    assert.equal(formatDocumentCode("0ABCD1234"), "0-ABCD-1234");
  });

  it("handles already-formatted input", () => {
    assert.equal(formatDocumentCode("0-ABCD-1234"), "0-ABCD-1234");
  });
});
