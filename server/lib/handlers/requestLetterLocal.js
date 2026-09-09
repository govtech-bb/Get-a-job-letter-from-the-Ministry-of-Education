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
import { MESSAGES, emailDomainMessage } from "../validationMessages.js";
import { isEmailFormat } from "../emailFormat.js";

export const LOCAL_ALLOWED_DOMAINS = ["moe.gov.bb"];

export function makeRequestLetterLocal({ findEmployeeByEmployeeId, issueLetter }) {
  return async function requestLetterLocal({ firstName, lastName, employeeId, email }) {
    const errors = [];
    if (!firstName?.trim()) errors.push({ field: "firstName", message: MESSAGES.firstNameMissing });
    if (!lastName?.trim()) errors.push({ field: "lastName", message: MESSAGES.lastNameMissing });
    if (!employeeId?.trim()) errors.push({ field: "employeeId", message: MESSAGES.employeeIdMissing });
    if (!email?.trim()) {
      errors.push({ field: "email", message: MESSAGES.emailMissing });
    } else if (!isEmailFormat(email)) {
      errors.push({ field: "email", message: MESSAGES.emailFormat });
    } else {
      const domain = email.split("@")[1].toLowerCase();
      if (!LOCAL_ALLOWED_DOMAINS.includes(domain)) {
        errors.push({ field: "email", message: emailDomainMessage(LOCAL_ALLOWED_DOMAINS) });
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
            { field: "email", message: MESSAGES.emailNameMismatch },
          ],
        },
      };
    }

    const employee = findEmployeeByEmployeeId(employeeId.trim());
    if (!employee || !employee.isActive) {
      return {
        status: 404,
        body: { error: "not_found", message: MESSAGES.recordNotFound },
      };
    }
    if (fNorm !== employee.firstName.toLowerCase() || lNorm !== employee.lastName.toLowerCase()) {
      return {
        status: 404,
        body: { error: "not_found", message: MESSAGES.nameDoesNotMatch },
      };
    }

    const letter = issueLetter(employee);
    return { status: 200, body: { ok: true, letterId: letter.id, letterToken: letter.token } };
  };
}
