import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normaliseNationalId } from "../server/lib/nationalId.js";
import { makeRequestLetterLocal } from "../server/lib/handlers/requestLetterLocal.js";
import { MESSAGES } from "../server/lib/validationMessages.js";

describe("normaliseNationalId", () => {
  for (const typed of ["123456-0001", "1234560001", " 123456 0001 ", "123456 - 0001"]) {
    it(`reads "${typed}" as 123456-0001`, () => {
      assert.equal(normaliseNationalId(typed), "123456-0001");
    });
  }

  for (const typed of ["", "12345-0001", "123456-00011", "ABC456-0001", "123456/0001"]) {
    it(`rejects "${typed}"`, () => {
      assert.equal(normaliseNationalId(typed), null);
    });
  }
});

describe("requesting a letter by National Identification (ID) number", () => {
  const employee = { employeeId: "123456-0001", firstName: "Judith", lastName: "Drakes", isActive: true };
  const request = makeRequestLetterLocal({
    findEmployeeByEmployeeId: (id) => (id === employee.employeeId ? employee : null),
    issueLetter: () => ({ id: "L1", token: "t" }),
  });
  const details = { firstName: "Judith", lastName: "Drakes", email: "judith.drakes@moe.gov.bb" };

  it("finds the record when the number is typed without the hyphen", async () => {
    const result = await request({ ...details, employeeId: "1234560001" });
    assert.equal(result.status, 200);
  });

  it("asks for a valid number when the shape is wrong", async () => {
    const result = await request({ ...details, employeeId: "12345" });
    assert.equal(result.status, 400);
    assert.deepEqual(result.body.errors, [{ field: "employeeId", message: MESSAGES.employeeIdFormat }]);
  });
});
