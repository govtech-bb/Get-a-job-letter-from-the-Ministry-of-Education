// Resend wrapper. Sends the letter PDF as an attachment.

import { Resend } from "resend";
import { recipientsForLetter } from "./recipients.js";

let _resend = null;
function client() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

export async function sendLetterEmail({ to, employee, pdfBuffer, letter, verifyUrl }) {
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";

  // While the sender domain is unverified, Resend only delivers to verified
  // recipients. RESEND_OVERRIDE_TO (comma-separated list, parsed by
  // recipients.js) redirects letter-delivery emails to that list instead of
  // the real citizen. The original intended recipient is prefixed onto the
  // subject so testers can tell which employee matched. Once `moe.gov.bb`
  // is verified in Resend, unset RESEND_OVERRIDE_TO and mail goes to the
  // actual employee.
  const overrideActive = !!process.env.RESEND_OVERRIDE_TO;
  const deliverTo = recipientsForLetter(to);
  const subject = overrideActive
    ? `[TEST → ${to}] Your Ministry of Education job letter`
    : "Your Ministry of Education job letter";

  const safe = s => (s || "").replace(/[^A-Za-z0-9.\-]+/g, "-");
  const filename = `Job-Letter-${safe(employee.firstName)}-${safe(employee.lastName)}.pdf`;

  const greetingName = employee.firstName || (to.split("@")[0] || "");
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";

  const text =
`${greeting}

Thank you for using the Ministry of Education job letters service. Your letter is attached to this email as a PDF.

To use it:
1. Open the attachment.
2. Forward or print the letter to share with your bank, credit union or retailer.
3. The recipient can verify the letter at ${verifyUrl}.

If you did not request this letter, you can ignore this email — no further action is needed.

Yours,
Personnel Department
Ministry of Education Transformation`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px;">
      <p>${greeting}</p>
      <p>Thank you for using the Ministry of Education job letters service. Your letter is attached to this email as a PDF.</p>
      <p>To use it:</p>
      <ol>
        <li>Open the attachment.</li>
        <li>Forward or print the letter to share with your bank, credit union or retailer.</li>
        <li>The recipient can verify the letter at <a href="${verifyUrl}">${verifyUrl}</a>.</li>
      </ol>
      <p>If you did not request this letter, you can ignore this email — no further action is needed.</p>
      <p style="color:#555;">
        Yours,<br />
        Personnel Department<br />
        Ministry of Education Transformation
      </p>
    </div>`;

  const { data, error } = await client().emails.send({
    from,
    to: deliverTo,
    subject,
    text,
    html,
    attachments: [
      { filename, content: Buffer.from(pdfBuffer).toString("base64") }
    ],
  });

  if (error) throw new Error("Resend send failed: " + (error.message || JSON.stringify(error)));
  return data;
}
