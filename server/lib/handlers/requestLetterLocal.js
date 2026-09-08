// Local-development twin of requestLetter, using the synthetic JSON dataset
// and the in-memory letter store instead of Postgres.
//
// It exists because requestLetter reaches for the database on its first line
// (listAllowedDomains), so without DATABASE_URL it throws rather than
// degrading. This was previously inlined in server/index.js and served only
// the JSON route, which meant the no-JavaScript form path had nothing to call.
// Same return shape as requestLetter — { status, body } — so callers do not
// care which one they got.

// What server/db/migrate.js seeds into allowed_domains, so local dev enforces
// the same rule the database would. The previous inlined fallback skipped this
// check entirely, which let the no-JavaScript path accept addresses the
// enhanced path rejected.
import { isEmailFormat } from "../emailFormat.js";

export const LOCAL_ALLOWED_DOMAINS = ["moe.gov.bb"];

export function makeRequestLetterLocal({ findEmployeeByEmployeeId, issueLetter }) {
  return async function requestLetterLocal({ firstName, lastName, employeeId, email }) {
    const errors = [];
    if (!firstName?.trim()) errors.push({ field: "firstName", message: "Enter your first name" });
    if (!lastName?.trim()) errors.push({ field: "lastName", message: "Enter your last name" });
    if (!employeeId?.trim()) errors.push({ field: "employeeId", message: "Enter your employee ID" });
    if (!isEmailFormat(email)) {
      errors.push({ field: "email", message: "Enter a valid email address" });
    }
    if (isEmailFormat(email)) {
      const domain = email.split("@")[1].toLowerCase();
      if (!LOCAL_ALLOWED_DOMAINS.includes(domain)) {
        errors.push({
          field: "email",
          message: `Enter an email address from an allowed domain (${LOCAL_ALLOWED_DOMAINS.join(", ")})`,
        });
      }
    }

    if (errors.length) return { status: 400, body: { error: "validation", errors } };

    const local = email.split("@")[0].toLowerCase();
    const fNorm = firstName.trim().toLowerCase();
    const lNorm = lastName.trim().toLowerCase();
    const lastParts = lNorm.split(/[-']/).filter(Boolean);
    const nameParts = [fNorm, ...lastParts];
    if (!nameParts.some((p) => p.length >= 2 && local.includes(p))) {
      return {
        status: 400,
        body: {
          error: "validation",
          errors: [
            { field: "email", message: "Your email address does not appear to match the name you entered" },
          ],
        },
      };
    }

    const employee = findEmployeeByEmployeeId(employeeId.trim());
    if (!employee || !employee.isActive) {
      return {
        status: 404,
        body: { error: "not_found", message: "We could not find a record for that employee ID." },
      };
    }
    if (fNorm !== employee.firstName.toLowerCase() || lNorm !== employee.lastName.toLowerCase()) {
      return {
        status: 404,
        body: { error: "not_found", message: "The name you entered does not match the record for that employee ID." },
      };
    }

    const letter = issueLetter(employee);
    return { status: 200, body: { ok: true, letterId: letter.id, letterToken: letter.token } };
  };
}
