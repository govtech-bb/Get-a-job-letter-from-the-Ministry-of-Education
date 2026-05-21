// Server-side PDF generation using pdf-lib. The QR code is a PNG produced by
// the qrcode lib and embedded as an image. The PDF carries the verification
// URL and reference, so anyone scanning can confirm authenticity.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { buildLetterBody } from "./letterTemplates.js";

const A4 = { width: 595.28, height: 841.89 }; // points
const MARGIN = 60;

export async function generateLetterPdf(letter) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.width, A4.height]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const timesRoman = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const issuedLong = new Date(letter.issuedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });

  let y = A4.height - MARGIN;

  // Letterhead — address block
  page.drawText("MINISTRY OF EDUCATION TRANSFORMATION", {
    x: MARGIN, y, size: 11, font: timesBold,
  });
  y -= 16;
  const addressLines = [
    "'Elsie Payne Complex'",
    "Constitution Road",
    "St. Michael BB 11124",
    "BARBADOS, W.I.",
  ];
  for (const line of addressLines) {
    page.drawText(line, { x: MARGIN, y, size: 10, font: timesRoman });
    y -= 13;
  }

  // Ref / Tel row
  y -= 18;
  page.drawText("Our Ref:", { x: MARGIN, y, size: 10, font: timesBold });
  page.drawText("P2954 Vol. I", { x: MARGIN + 48, y, size: 10, font: timesRoman });
  page.drawText("Tel. No.:", { x: A4.width - MARGIN - 120, y, size: 10, font: timesBold });
  page.drawText("(246) 535-0600", { x: A4.width - MARGIN - 78, y, size: 10, font: timesRoman });
  y -= 22;

  // Date
  page.drawText("Date:", { x: MARGIN, y, size: 10, font: timesBold });
  page.drawText(issuedLong, { x: MARGIN + 36, y, size: 10, font: timesRoman });
  y -= 30;

  // Heading
  const headingText = "TO WHOM IT MAY CONCERN";
  const headingWidth = timesBold.widthOfTextAtSize(headingText, 12);
  const headingX = (A4.width - headingWidth) / 2;
  page.drawText(headingText, { x: headingX, y, size: 12, font: timesBold });
  // underline
  page.drawLine({
    start: { x: headingX, y: y - 2 },
    end: { x: headingX + headingWidth, y: y - 2 },
    thickness: 0.8,
    color: rgb(0, 0, 0),
  });
  y -= 30;

  // Body paragraphs
  const paragraphs = buildLetterBody(letter.employee);
  for (const para of paragraphs) {
    y = drawWrappedParagraph(page, para, {
      x: MARGIN,
      y,
      maxWidth: A4.width - MARGIN * 2,
      font: timesRoman,
      size: 11,
      lineHeight: 15,
      firstLineIndent: 24,
    });
    y -= 10;
  }

  // Signature
  y -= 20;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 200, y },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3),
    dashArray: [2, 2],
  });
  y -= 14;
  page.drawText("H. HOLLIGAN (Ms.)", { x: MARGIN, y, size: 10, font: timesBold });
  y -= 13;
  page.drawText("for Permanent Secretary", { x: MARGIN, y, size: 10, font: timesItalic });
  y -= 22;
  page.drawText("HH/rp", { x: MARGIN, y, size: 9, font: timesBold });

  // Verification footer with QR code
  const qrPngBytes = await QRCode.toBuffer(letter.verifyUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
  const qrImage = await doc.embedPng(qrPngBytes);
  const qrSize = 96;
  const qrX = A4.width - MARGIN - qrSize;
  const qrY = MARGIN;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // Footer text next to QR
  const footerY = qrY + qrSize - 12;
  page.drawText("Verify this letter", { x: MARGIN, y: footerY, size: 9, font: helvBold });
  page.drawText("Scan the QR code or visit:", { x: MARGIN, y: footerY - 12, size: 9, font: helv });
  page.drawText(letter.verifyUrl, { x: MARGIN, y: footerY - 24, size: 8.5, font: helv, color: rgb(0.05, 0.36, 0.39) });
  page.drawText("Reference: " + letter.id, { x: MARGIN, y: footerY - 40, size: 8.5, font: helv });
  page.drawText("Issued: " + issuedLong, { x: MARGIN, y: footerY - 52, size: 8.5, font: helv });
  page.drawText("This letter is signed digitally. Any alteration will invalidate verification.",
    { x: MARGIN, y: footerY - 68, size: 7.5, font: helv, color: rgb(0.35, 0.35, 0.35) });

  const bytes = await doc.save();
  return bytes;
}

function drawWrappedParagraph(page, text, opts) {
  const { x, maxWidth, font, size, lineHeight, firstLineIndent = 0 } = opts;
  let y = opts.y;
  const words = text.split(/\s+/);
  let line = "";
  let isFirst = true;
  const indent = firstLineIndent;

  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    const allowed = maxWidth - (isFirst ? indent : 0);
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > allowed && line) {
      page.drawText(line, { x: x + (isFirst ? indent : 0), y, size, font });
      y -= lineHeight;
      line = word;
      isFirst = false;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x: x + (isFirst ? indent : 0), y, size, font });
    y -= lineHeight;
  }
  return y;
}
