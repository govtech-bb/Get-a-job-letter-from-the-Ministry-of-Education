import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normaliseNationalId } from "../server/lib/nationalId.js";
import { makeRequestLetterLocal } from "../server/lib/handlers/requestLetterLocal.js";
import { MESSAGES } from "../server/lib/validationMessages.js";
import { previewUpload } from "../server/lib/handlers/adminUpload.js";
import { createEmployee } from "../server/lib/handlers/adminEmployees.js";

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

// Records have to be saved in the form the request lookup searches for, or the
// employee can never be matched. Each case here fails validation before any
// database call.
describe("saving an employee's National Registration number from the admin console", () => {
  const csvRow = (employeeId, email) =>
    `${employeeId},${email},Ms.,Judith,Drakes,she,teacher_appointed,Graduate Teacher,Alleyne School,2019-09-01,5965.60`;
  const csv = (...rows) =>
    ["employee_id,email,title,first_name,last_name,pronoun,letter_type,post,school,appointment_date,monthly_salary", ...rows].join("\n");

  it("rejects an uploaded ID that is not a National Registration number", async () => {
    const result = await previewUpload(csv(csvRow("EMP-42", "judith.drakes@moe.gov.bb")));
    assert.equal(result.error, "validation");
    assert.match(result.validationErrors[0].errors[0], /National Registration number/);
  });

  it("normalises an uploaded ID, so 1234560001 and 123456-0001 are the same employee", async () => {
    const result = await previewUpload(
      csv(csvRow("1234560001", "judith.drakes@moe.gov.bb"), csvRow("123456-0001", "j.drakes@moe.gov.bb"))
    );
    assert.equal(result.validationErrors[0].employeeId, "123456-0001");
    assert.match(result.validationErrors[0].errors[0], /Duplicate employee ID/);
  });

  it("rejects an edited ID that is not a National Registration number", async () => {
    const result = await createEmployee({ body: { email: "judith.drakes@moe.gov.bb", employeeId: "EMP-42" }, changedBy: "test" });
    assert.equal(result.status, 400);
    assert.ok(result.body.errors.some((e) => e.field === "employeeId"));
  });
});
