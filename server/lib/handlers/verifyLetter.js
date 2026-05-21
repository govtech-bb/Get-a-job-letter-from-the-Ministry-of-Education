// Public letter verification. Anyone with the QR/URL can call this to confirm
// that a letter was actually issued by the service.

import { findIssuedLetter } from "../db.js";
import { verifySignature } from "../sign.js";

export async function verifyLetter({ id, signature }) {
  if (!id || !signature) {
    return { status: 400, body: { valid: false, reason: "Missing reference or signature." } };
  }

  if (!verifySignature(id, signature)) {
    return {
      status: 200,
      body: { valid: false, reason: "The verification code does not match. This letter may have been altered." },
    };
  }

  const row = await findIssuedLetter(id);
  if (!row) {
    return {
      status: 200,
      body: { valid: false, reason: "We have no record of a letter with that reference." },
    };
  }

  // The verify page deliberately does NOT include salary.
  const e = row.employee;
  return {
    status: 200,
    body: {
      valid: true,
      letter: {
        id: row.id,
        issuedAt: row.issuedAt,
        validUntil: row.validUntil,
        employee: {
          title: e.title,
          firstName: e.firstName,
          lastName: e.lastName,
          post: e.post,
          school: e.school,
          employer: e.employer,
          letterType: e.letterType,
        },
      },
    },
  };
}
