// Quick local test: generate a PDF for a known employee and write it to disk
// so we can visually inspect the letterhead.

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { findEmployeeByEmail } from "../server/lib/db.js";
import { generateLetterPdf } from "../server/pdf.js";
import { newLetterId, signLetterId, validUntil } from "../server/lib/sign.js";

dotenv.config({ path: ".env.local" });

const email = process.argv[2] || "marcus.bynoe@moe.gov.bb";
const employee = await findEmployeeByEmail(email);
if (!employee) {
  console.error("No employee for", email);
  process.exit(1);
}
const id = newLetterId();
const signature = signLetterId(id);
const verifyUrl = `http://localhost:3000/v?id=${id}&t=${signature}`;
const bytes = await generateLetterPdf({
  id,
  employee,
  issuedAt: new Date().toISOString(),
  validUntil: validUntil(),
  verifyUrl,
});
const out = path.join("scripts", "out", "test-letter.pdf");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, bytes);
console.log(`Wrote ${out} (${Math.round(bytes.length / 1024)} KB) — verifyUrl: ${verifyUrl}`);
