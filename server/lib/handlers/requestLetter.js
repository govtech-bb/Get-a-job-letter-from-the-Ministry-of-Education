// Pure handler logic. Called by both the Express dev server and the Vercel
// serverless wrapper in /api/request-letter.js.

import { findEmployeeByEmployeeId, insertIssuedLetter, updateLetterEmailStatus, listAllowedDomains } from "../db.js";
import { newLetterId, signLetterId, validUntil } from "../sign.js";
import { generateDocumentCode, formatDocumentCode } from "../fingerprint.js";
import { generateLetterPdf } from "../../pdf.js";
import { sendLetterEmail } from "../email.js";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalise(s) {
  return String(s || "").trim().toLowerCase();
}

function emailPlausiblyMatchesName(email, firstName, lastName) {
  const local = email.split("@")[0].toLowerCase();
  const first = normalise(firstName);
  const last = normalise(lastName);

  // For hyphenated last names like "Taitt-Hope", check each part too.
  const lastParts = last.split(/[-']/).filter(Boolean);
  const nameParts = [first, ...lastParts];

  // The local part must contain at least one recognisable name component.
  return nameParts.some(part => part.length >= 2 && local.includes(part));
}

function namesMatch(provided, record) {
  return normalise(provided) === normalise(record);
}

export async function requestLetter({ firstName, lastName, employeeId, email, publicBaseUrl }) {
  const errors = [];

  if (!firstName?.trim()) errors.push({ field: "firstName", message: "Enter your first name" });
  if (!lastName?.trim()) errors.push({ field: "lastName", message: "Enter your last name" });
  if (!employeeId?.trim()) errors.push({ field: "employeeId", message: "Enter your employee ID" });

  if (!email || !EMAIL_RX.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    const allowedDomains = (await listAllowedDomains()).map(r => r.domain.toLowerCase());
    const emailDomain = email.split("@")[1].toLowerCase();
    if (allowedDomains.length && !allowedDomains.includes(emailDomain)) {
      const domainList = allowedDomains.join(", ");
      errors.push({ field: "email", message: `Enter an email address from an allowed domain (${domainList})` });
    }
  }

  if (errors.length) {
    return { status: 400, body: { error: "validation", errors } };
  }

  if (!emailPlausiblyMatchesName(email, firstName, lastName)) {
    return {
      status: 400,
      body: {
        error: "validation",
        errors: [{
          field: "email",
          message: "Your email address does not appear to match the name you entered",
        }],
      },
    };
  }

  const employee = await findEmployeeByEmployeeId(employeeId.trim());
  if (!employee || !employee.isActive) {
    return { status: 404, body: { error: "not_found", message: "We could not find a record for that employee ID." } };
  }

  if (!namesMatch(firstName, employee.firstName) || !namesMatch(lastName, employee.lastName)) {
    return { status: 404, body: { error: "not_found", message: "The name you entered does not match the record for that employee ID." } };
  }

  const id = newLetterId();
  const signature = signLetterId(id);
  const validUntilIso = validUntil();
  const issuedAt = new Date().toISOString();

  let documentCode = null;
  let formattedCode = null;
  try {
    documentCode = generateDocumentCode(employee);
    formattedCode = formatDocumentCode(documentCode);
  } catch (err) {
    console.warn("fingerprint: could not generate document code:", err.message);
  }

  await insertIssuedLetter({
    id,
    signature,
    documentCode,
    recipientEmail: email,
    employeeSnapshot: employee,
    validUntil: validUntilIso,
  });

  const verifyUrl = `${publicBaseUrl}/v?id=${encodeURIComponent(id)}&t=${encodeURIComponent(signature)}`;
  const pdfBytes = await generateLetterPdf({
    id,
    employee,
    issuedAt,
    validUntil: validUntilIso,
    verifyUrl,
    documentCode: formattedCode,
  });

  let messageId = null;
  if (!process.env.RESEND_API_KEY) {
    console.log(`request-letter: RESEND_API_KEY not set — skipping email to ${email}`);
    await updateLetterEmailStatus(id, null, "skipped");
  } else {
    try {
      const result = await sendLetterEmail({
        to: email,
        employee,
        pdfBuffer: pdfBytes,
        letter: { id, issuedAt, validUntil: validUntilIso },
        verifyUrl,
      });
      messageId = result?.id || null;
      await updateLetterEmailStatus(id, messageId, "sent");
    } catch (err) {
      await updateLetterEmailStatus(id, null, "failed: " + (err.message || "unknown"));
      return {
        status: 502,
        body: {
          error: "email_send_failed",
          message: "The letter was generated but we couldn't send the email. Please try again.",
          letterId: id,
        },
      };
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      letterId: id,
      letterToken: signature,
      messageId,
      verifyUrl,
    },
  };
}
