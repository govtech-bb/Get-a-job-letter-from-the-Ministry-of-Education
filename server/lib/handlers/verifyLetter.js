// Public letter verification. Two-step challenge flow:
//
// Step 1 (GET /verify/:id?t=...): Confirms the reference exists and shows
//   limited info. If the letter has a document code, the response includes
//   hasDocumentCode: true and the verifier must submit the code to proceed.
//
// Step 2 (POST /verify/:id/challenge): Verifier submits the document code
//   printed on the letter. On match, the full (non-salary) details are returned.

import crypto from "node:crypto";
import { findIssuedLetter, insertVerificationAttempt, countRecentAttempts } from "../db.js";
import { verifySignature } from "../sign.js";
import { verifyDocumentCode } from "../fingerprint.js";

const MAX_CODE_ATTEMPTS = 5;
const RATE_WINDOW_MINUTES = 15;

const INCOMPLETE_LINK = "This link is incomplete. Scan the QR code on the letter instead.";
const LINK_DOES_NOT_MATCH = "This link does not match a letter the Ministry issued. Check it was entered correctly, or scan the QR code on the letter instead.";
const NO_RECORD = "We have no record of a letter with this reference.";

function hashSource(ip) {
  return crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 16);
}

export async function verifyLetter({ id, signature, sourceIp }) {
  if (!id || !signature) {
    return { status: 400, body: { valid: false, reason: INCOMPLETE_LINK } };
  }

  if (!verifySignature(id, signature)) {
    return {
      status: 200,
      body: { valid: false, reason: LINK_DOES_NOT_MATCH },
    };
  }

  const row = await findIssuedLetter(id);
  if (!row) {
    return {
      status: 200,
      body: { valid: false, reason: NO_RECORD },
    };
  }

  const sourceHash = hashSource(sourceIp);
  await insertVerificationAttempt({
    letterId: id,
    sourceHash,
    codeSubmitted: null,
    result: "pass",
  }).catch(() => {});

  const e = row.employee;

  if (row.documentCode) {
    return {
      status: 200,
      body: {
        valid: true,
        hasDocumentCode: true,
        letter: {
          id: row.id,
          issuedAt: row.issuedAt,
          validUntil: row.validUntil,
          employee: {
            title: e.title,
            firstName: e.firstName,
            lastName: e.lastName,
          },
        },
      },
    };
  }

  return {
    status: 200,
    body: {
      valid: true,
      hasDocumentCode: false,
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

export async function challengeLetter({ id, signature, code, sourceIp }) {
  if (!id || !signature) {
    return { status: 400, body: { valid: false, reason: INCOMPLETE_LINK } };
  }
  if (!code) {
    return { status: 400, body: { valid: false, reason: "Enter the document code printed at the bottom of the letter." } };
  }

  if (!verifySignature(id, signature)) {
    return { status: 200, body: { valid: false, reason: LINK_DOES_NOT_MATCH } };
  }

  const row = await findIssuedLetter(id);
  if (!row) {
    return { status: 200, body: { valid: false, reason: NO_RECORD } };
  }

  const sourceHash = hashSource(sourceIp);

  const recentFails = await countRecentAttempts(id, RATE_WINDOW_MINUTES).catch(() => 0);
  if (recentFails >= MAX_CODE_ATTEMPTS) {
    await insertVerificationAttempt({
      letterId: id,
      sourceHash,
      codeSubmitted: code.slice(0, 20),
      result: "rate_limited",
    }).catch(() => {});

    return {
      status: 429,
      body: {
        valid: false,
        rateLimited: true,
        reason: "Too many attempts. Please wait 15 minutes before trying again.",
      },
    };
  }

  const e = row.employee;
  const match = verifyDocumentCode(e, code);

  await insertVerificationAttempt({
    letterId: id,
    sourceHash,
    codeSubmitted: code.slice(0, 20),
    result: match ? "pass" : "fail",
  }).catch(() => {});

  if (!match) {
    return {
      status: 200,
      body: {
        valid: false,
        codeMatch: false,
        reason: "The document code does not match. Check the code printed on the letter and try again.",
        attemptsRemaining: Math.max(0, MAX_CODE_ATTEMPTS - recentFails - 1),
      },
    };
  }

  return {
    status: 200,
    body: {
      valid: true,
      codeMatch: true,
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
