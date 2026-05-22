// Pure handler logic. Called by both the Express dev server and the Vercel
// serverless wrapper in /api/request-letter.js.

import { findEmployeeByEmail, insertIssuedLetter, updateLetterEmailStatus } from "../db.js";
import { newLetterId, signLetterId, validUntil } from "../sign.js";
import { generateLetterPdf } from "../../pdf.js";
import { sendLetterEmail } from "../email.js";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestLetter({ email, publicBaseUrl }) {
  if (!email || !EMAIL_RX.test(email)) {
    return { status: 400, body: { error: "invalid_email", message: "Enter a valid work email address." } };
  }

  const employee = await findEmployeeByEmail(email);
  if (!employee || !employee.isActive) {
    // Don't tell the caller whether the email exists — privacy/anti-enumeration.
    // But for the alpha demo a clearer message is more useful, so we surface it.
    return { status: 404, body: { error: "not_found", message: "We could not find a record for that email." } };
  }

  const id = newLetterId();
  const signature = signLetterId(id);
  const validUntilIso = validUntil();
  const issuedAt = new Date().toISOString();

  // Snapshot the employee record at the time of issue so the verify page shows
  // what the letter said even if the employee record later changes.
  await insertIssuedLetter({
    id,
    signature,
    recipientEmail: email,
    employeeSnapshot: employee,
    validUntil: validUntilIso,
  });

  // Short verify URL — easier to read on the printed letter and produces a
  // simpler QR code. The /v path is rewritten to /verify.html via vercel.json
  // (and verify.html accepts ?id= and ?t= directly).
  const verifyUrl = `${publicBaseUrl}/v?id=${encodeURIComponent(id)}&t=${encodeURIComponent(signature)}`;
  const pdfBytes = await generateLetterPdf({
    id,
    employee,
    issuedAt,
    validUntil: validUntilIso,
    verifyUrl,
  });

  // Send the email (with the PDF attached).
  let messageId = null;
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

  return {
    status: 200,
    body: {
      ok: true,
      letterId: id,
      messageId,
      verifyUrl,
    },
  };
}
