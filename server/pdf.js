// Server-side PDF generation using pdf-lib. The QR code is a PNG produced by
// the qrcode lib and embedded as an image. The PDF carries the verification
// URL and reference, so anyone scanning can confirm authenticity.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { buildLetterBody } from "./letterTemplates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const A4 = { width: 595.28, height: 841.89 }; // points
const MARGIN = 60;

// Letterhead logos. Loaded once at module init so PDF generation in each
// serverless invocation doesn't re-read the files.
// Letterhead images are resolved from whichever of these roots actually has
// them: next to the module (local dev / nft-copied bundle) or the function's
// working directory (Netlify included_files). Read once, then cached.
const ASSET_ROOTS = [ROOT, process.cwd(), path.join(process.cwd(), "..")];

const assetCache = new Map();

function readAsset(...segments) {
  const key = segments.join("/");
  if (assetCache.has(key)) return assetCache.get(key);
  const tried = [];
  for (const root of ASSET_ROOTS) {
    const candidate = path.join(root, ...segments);
    tried.push(candidate);
    if (fs.existsSync(candidate)) {
      const buf = fs.readFileSync(candidate);
      assetCache.set(key, buf);
      return buf;
    }
  }
  throw new Error(`Letterhead asset ${key} not found. Looked in: ${tried.join(", ")}`);
}

const crestPng = () => readAsset("assets", "images", "govbb-creast.png");
const moeLogoPng = () => readAsset("assets", "images", "moe-logo.png");

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

  // Letterhead: coat of arms (left) | address (centre) | MoE logo (right).
  const crest = await doc.embedPng(crestPng());
  const moeLogo = await doc.embedPng(moeLogoPng());
  const LOGO_SIZE = 78;
  const headerTop = y;
  const headerBottom = headerTop - LOGO_SIZE;
  // Coat of arms — left
  page.drawImage(crest, {
    x: MARGIN,
    y: headerBottom,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  });
  // MoE logo — right
  page.drawImage(moeLogo, {
    x: A4.width - MARGIN - LOGO_SIZE,
    y: headerBottom,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  });
  // Centred address block
  const addressLines = [
    { text: "MINISTRY OF EDUCATION TRANSFORMATION", font: timesBold, size: 11 },
    { text: "'Elsie Payne Complex'",                font: timesRoman, size: 10 },
    { text: "Constitution Road",                    font: timesRoman, size: 10 },
    { text: "St. Michael BB 11124",                 font: timesRoman, size: 10 },
    { text: "BARBADOS, W.I.",                       font: timesRoman, size: 10 },
  ];
  // Vertically centre the address block on the logos
  const totalAddrHeight = 14 + (addressLines.length - 1) * 13;
  let addrY = headerBottom + (LOGO_SIZE + totalAddrHeight) / 2 - 4;
  for (const line of addressLines) {
    const w = line.font.widthOfTextAtSize(line.text, line.size);
    page.drawText(line.text, {
      x: (A4.width - w) / 2,
      y: addrY,
      size: line.size,
      font: line.font,
    });
    addrY -= line.size === 11 ? 14 : 13;
  }
  y = headerBottom - 18;

  // Thin rule under the letterhead
  page.drawLine({
    start: { x: MARGIN, y },
    end:   { x: A4.width - MARGIN, y },
    thickness: 0.6,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 16;
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
