import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLetterBody, moneyToWords, moneyFormatted } from "../server/letterTemplates.js";

const LETTER_TYPES = [
  "teacher_appointed",
  "teacher_special",
  "teacher_temporary",
  "ministry_permanent",
  "ministry_temporary",
];

function employee(overrides = {}) {
  return {
    title: "Ms.",
    firstName: "Alexcia",
    lastName: "Taitt-Hope",
    address: "Bush Hall, St. Michael",
    letterType: "teacher_appointed",
    post: "Graduate Teacher",
    school: "A. DaCosta Edwards Primary",
    employer: "Ministry of Education Transformation",
    appointmentDate: "2007-09-01",
    monthlySalary: 6453.41,
    monthlyAllowance: 697.74,
    payFrequency: "monthly",
    ...overrides,
  };
}

// The letter used to derive "He"/"She" and "him"/"her" from a two-value field,
// so a record with a missing or unexpected value was addressed as "She" on a
// signed government document the employee cannot correct.
describe("letter body gendered wording", () => {
  const GENDERED = /\b(he|she|him|her|his|hers)\b/i;

  for (const letterType of LETTER_TYPES) {
    for (const pronoun of ["he", "she", "they", "", null, undefined]) {
      it(`${letterType} names no pronoun when the record says ${JSON.stringify(pronoun)}`, () => {
        const body = buildLetterBody(employee({ letterType, pronoun })).join(" ");
        assert.equal(GENDERED.test(body), false, body);
      });
    }
  }

  it("does not read the pronoun field at all", () => {
    const withField = buildLetterBody(employee({ pronoun: "he" }));
    const without = buildLetterBody(employee());
    assert.deepEqual(withField, without);
  });
});

describe("letter body currency", () => {
  it("states the currency in words", () => {
    assert.match(moneyToWords(6453.41), /Barbados dollars/);
  });

  it("states the currency in figures", () => {
    assert.equal(moneyFormatted(6453.41), "BDS $6,453.41");
  });

  it("keeps the singular for one dollar", () => {
    assert.match(moneyToWords(1), /^one Barbados dollar$/);
  });

  for (const letterType of LETTER_TYPES) {
    it(`${letterType} quotes a salary in Barbados dollars`, () => {
      const body = buildLetterBody(employee({ letterType })).join(" ");
      assert.match(body, /BDS \$6,453\.41/);
      assert.match(body, /Barbados dollars/);
    });
  }
});
