// Static port of the Job Letters service, for GitHub Pages.
//
// IMPORTANT: this is the demo-only static build. On the real Node server,
// HMAC signing keeps the verification key secret. In the browser, the key
// must ship with the bundle — see DEMO_KEY below. So the static verify page
// proves "the letter says what its URL says" rather than "the letter was
// issued by MoE". The real deployment uses the server in /server.

const DEMO_KEY = "alpha-demo-key-not-for-production";
const LETTER_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/* ---------- Number → words (for the letter body) ---------- */
const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n) {
  let s = "";
  if (n >= 100) { s += ones[Math.floor(n / 100)] + " hundred"; n %= 100; if (n) s += " and "; }
  if (n >= 20) { s += tens[Math.floor(n / 10)]; n %= 10; if (n) s += "-" + ones[n]; }
  else if (n > 0) { s += ones[n]; }
  return s;
}
function intToWords(n) {
  if (n === 0) return "zero";
  const parts = []; const scales = ["", "thousand", "million", "billion"]; let i = 0;
  while (n > 0) {
    const c = n % 1000;
    if (c) parts.unshift(under1000(c) + (scales[i] ? " " + scales[i] : ""));
    n = Math.floor(n / 1000); i++;
  }
  return parts.join(", ");
}
function moneyToWords(value) {
  if (value == null || isNaN(value)) return "";
  const v = Math.round(Number(value) * 100);
  const dollars = Math.floor(v / 100), cents = v % 100;
  let s = intToWords(dollars) + " dollar" + (dollars === 1 ? "" : "s");
  if (cents > 0) s += " and " + intToWords(cents) + " cent" + (cents === 1 ? "" : "s");
  return s;
}
function moneyFormatted(value) {
  const v = Number(value || 0);
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatLongDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function formatDateTime(d) {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------- Letter body templates ---------- */
function buildLetterBody(employee) {
  const fullName = [employee.title, employee.firstName, employee.lastName].filter(Boolean).join(" ");
  const titleLast = [employee.title, employee.lastName].filter(Boolean).join(" ");
  const pronounSubj = employee.pronoun === "he" ? "He" : "She";
  const pronounObj = employee.pronoun === "he" ? "him" : "her";
  const salaryWords = moneyToWords(employee.monthlySalary);
  const salaryFig = moneyFormatted(employee.monthlySalary);
  const startDate = formatLongDate(employee.appointmentDate);

  switch (employee.letterType) {
    case "teacher_appointed":
      return [
        `This is to certify that ${fullName}, ${employee.post}, ${employee.school}, has been employed with the Ministry of Education Transformation with effect from ${startDate} to the present date and holds a permanent and pensionable post.`,
        `${titleLast} is currently receiving a monthly salary of ${salaryWords} (${salaryFig}).`,
        `Grateful if the usual courtesies are extended to ${pronounObj}.`,
      ];
    case "teacher_special": {
      const allowWords = moneyToWords(employee.monthlyAllowance);
      const allowFig = moneyFormatted(employee.monthlyAllowance);
      return [
        `This is to certify that ${fullName}, ${employee.post}, ${employee.school}, has been employed with the Ministry of Education Transformation with effect from ${startDate} to the present date and holds a permanent and pensionable post.`,
        `${titleLast} is currently receiving a monthly salary of ${salaryWords} (${salaryFig}) and a monthly allowance of ${allowWords} (${allowFig}).`,
        `Grateful if the usual courtesies are extended to ${pronounObj}.`,
      ];
    }
    case "ministry_permanent":
      return [
        `This is to certify that ${fullName} of ${employee.address} has been continuously employed in the Public Service with effect from ${startDate}.`,
        `${fullName} holds the permanent and pensionable post of ${employee.post}, Ministry of Education Transformation.`,
        `${pronounSubj} receives a ${employee.payFrequency} salary at the rate of ${salaryWords} (${salaryFig}).`,
        `Any courtesies extended to ${fullName} would be appreciated.`,
      ];
    case "ministry_temporary":
      return [
        `This is to certify that ${fullName} of ${employee.address} has been continuously employed in the Public Service with effect from ${startDate}.`,
        `${fullName} is temporarily employed in the post of ${employee.post}, Ministry of Education Transformation.`,
        `${pronounSubj} receives a ${employee.payFrequency} salary at the rate of ${salaryWords} (${salaryFig}).`,
        `Any courtesies extended to ${fullName} would be appreciated.`,
      ];
    default:
      throw new Error("Unknown letter type: " + employee.letterType);
  }
}

/* ---------- Letter payload (base64 URL-safe JSON) + demo hash ---------- */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function b64urlEncode(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
}

async function issueLetter(employee) {
  const id = "MOE-" + Date.now().toString(36).toUpperCase() + "-" +
    Array.from(crypto.getRandomValues(new Uint8Array(3)))
      .map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const issuedAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + LETTER_TTL_MS).toISOString();
  const payload = { id, issuedAt, validUntil, employee };
  const json = JSON.stringify(payload);
  const sig = (await sha256Hex(json + DEMO_KEY)).slice(0, 16);
  payload.sig = sig;
  return { letter: payload, token: b64urlEncode(JSON.stringify(payload)) };
}

async function decodeAndVerify(token) {
  try {
    const json = b64urlDecode(token);
    const payload = JSON.parse(json);
    const { sig, ...rest } = payload;
    const expected = (await sha256Hex(JSON.stringify(rest) + DEMO_KEY)).slice(0, 16);
    if (sig !== expected) {
      return { valid: false, reason: "The verification code does not match. This letter may have been altered." };
    }
    return { valid: true, letter: payload };
  } catch (err) {
    return { valid: false, reason: "We could not read the letter reference. The link may be incomplete." };
  }
}

/* ---------- HTML preview of the letter ---------- */
// `mode` is "preview" (on-screen card with a border) or "pdf" (full-bleed A4
// content, no border). Both share the same inner layout so what the user sees
// in the preview is what comes out of the PDF.
function renderLetterHtml(letter, opts = {}) {
  const paragraphs = buildLetterBody(letter.employee).map(p => `<p style="margin:0 0 10pt;text-align:justify;text-indent:24pt;">${escapeHtml(p)}</p>`).join("");
  const issuedLong = formatLongDate(letter.issuedAt);
  const verifyUrl = opts.verifyUrl || (location.origin + location.pathname.replace(/[^/]*$/, "verify.html") + "#" + opts.token);
  const mode = opts.mode || "preview";

  // Outer container: preview gets a card border, pdf is flush to the page.
  const outerStyle = mode === "pdf"
    ? "background:#fff;font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.45;color:#111;padding:0;"
    : "background:#fff;border:1px solid #d8dde3;border-radius:4px;padding:32pt 36pt;font-family:'Times New Roman',Times,serif;font-size:11pt;line-height:1.45;color:#111;max-width:720px;";

  return `
    <div style="${outerStyle}">
      <!-- Letterhead: coat of arms (left) | address (centre) | MoE logo (right).
           Both side marks are square and sized identically so the header is
           visually balanced. -->
      <div style="display:grid;grid-template-columns:110px 1fr 110px;gap:20pt;align-items:center;margin-bottom:14pt;">
        <img src="assets/images/govbb-creast.svg" alt="Coat of Arms of Barbados"
             style="width:110px;height:110px;object-fit:contain;display:block;" />
        <div style="text-align:center;line-height:1.3;">
          <div style="font-weight:bold;text-transform:uppercase;font-size:11pt;letter-spacing:.02em;">MINISTRY OF EDUCATION TRANSFORMATION</div>
          <div style="font-size:10.5pt;">'Elsie Payne Complex'</div>
          <div style="font-size:10.5pt;">Constitution Road</div>
          <div style="font-size:10.5pt;">St. Michael BB 11124</div>
          <div style="font-size:10.5pt;">BARBADOS, W.I.</div>
        </div>
        <img src="assets/images/moe-logo.png" alt="Ministry of Education logo"
             style="width:110px;height:110px;object-fit:contain;display:block;margin-left:auto;" />
      </div>

      <hr style="border:0;border-top:1px solid #444;margin:6pt 0 12pt;" />

      <div style="display:flex;justify-content:space-between;font-size:10.5pt;">
        <span><strong>Our Ref:</strong> P2954 Vol. I</span>
        <span><strong>Tel. No.:</strong> (246) 535-0600</span>
      </div>
      <div style="margin-top:14pt;font-size:10.5pt;"><strong>Date:</strong> ${escapeHtml(issuedLong)}</div>

      <h3 style="text-align:center;font-weight:bold;text-decoration:underline;margin:16pt 0 14pt;font-size:13pt;letter-spacing:.02em;">TO WHOM IT MAY CONCERN</h3>

      <div>${paragraphs}</div>

      <div style="margin-top:22pt;">
        <div style="border-bottom:1px dotted #555;width:230px;margin-bottom:4pt;">&nbsp;</div>
        <div style="font-weight:bold;font-size:10.5pt;">H. HOLLIGAN (Ms.)</div>
        <div style="font-style:italic;font-size:10.5pt;"><i>for</i> Permanent Secretary</div>
      </div>

      <div style="margin-top:10pt;font-size:9pt;font-weight:bold;">HH/rp</div>

      <div style="display:flex;gap:12pt;margin-top:14pt;border-top:1px solid #ddd;padding-top:8pt;font-size:8.5pt;color:#444;align-items:flex-start;">
        <div id="letter-qr" style="flex:0 0 auto;"></div>
        <div style="flex:1;">
          <strong>Verify this letter</strong><br />
          Scan the QR code or visit:<br />
          <span style="word-break:break-all;color:#0e5f64;">${escapeHtml(verifyUrl)}</span><br />
          Reference: <code>${escapeHtml(letter.id)}</code><br />
          Issued: ${escapeHtml(issuedLong)}
        </div>
      </div>
    </div>`;
}

function injectQrInto(target, url) {
  const qr = new QRCode(target, {
    text: url, width: 88, height: 88,
    correctLevel: QRCode.CorrectLevel.M,
  });
  return qr;
}

/* ---------- PDF generation (client-side via html2pdf) ---------- */
// Renders the letter into a full A4 page. The wrap is sized exactly to A4
// portrait (210x297mm) with standard letter margins. We let html2pdf set the
// margin to 0 because the wrap already has padding for the print margins.
async function downloadPdf(letter, verifyUrl) {
  const wrap = document.createElement("div");
  // html2canvas needs the element to be in real layout (offscreen positioning
  // or opacity:0 produces a blank capture). `clip-path: inset(100%)` clips it
  // to nothing visually while preserving layout and image painting.
  //
  // Height is locked to exactly A4 (297mm) and overflow hidden, so html2pdf
  // never splits the content into a second page. Any content that doesn't fit
  // is clipped — but the body is intentionally short enough that it does.
  wrap.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    "width:210mm",
    "height:297mm",
    "padding:22mm 20mm",  // standard formal-letter margins
    "background:#fff",
    "box-sizing:border-box",
    "font-family:'Times New Roman',Times,serif",
    "color:#111",
    "overflow:hidden",
    "clip-path:inset(100%)",
    "pointer-events:none",
  ].join(";");
  wrap.innerHTML = renderLetterHtml(letter, { verifyUrl, mode: "pdf" });
  document.body.appendChild(wrap);

  // Render QR into the placeholder
  const qrTarget = wrap.querySelector("#letter-qr");
  if (qrTarget) injectQrInto(qrTarget, verifyUrl);

  // Wait a tick so the SVG/PNG images finish loading before html2canvas snapshots.
  await Promise.all(Array.from(wrap.querySelectorAll("img")).map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }));

  const safe = s => (s || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = `Job-Letter-${safe(letter.employee.firstName)}-${safe(letter.employee.lastName)}-${letter.id}.pdf`;

  // Drive html2canvas + jsPDF directly. We avoid html2pdf because it slices
  // the canvas into multiple A4 pages when content is even one pixel taller
  // than the page, which produced the previous "cut into two pages" output.
  try {
    const canvas = await html2canvas(wrap, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: wrap.offsetWidth,
      height: wrap.offsetHeight,
      windowWidth: wrap.offsetWidth,
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    pdf.save(filename);
  } finally {
    document.body.removeChild(wrap);
  }
}

/* ---------- Data load ---------- */
let _employeesPromise = null;
function loadEmployees() {
  if (!_employeesPromise) {
    _employeesPromise = fetch("employees.json").then(r => r.json()).then(d => d.employees);
  }
  return _employeesPromise;
}

async function findEmployeeByEmail(email) {
  const list = await loadEmployees();
  const needle = String(email || "").trim().toLowerCase();
  if (!needle) return null;
  return list.find(e => e.email.toLowerCase() === needle) || null;
}

function employmentLabel(letterType) {
  switch (letterType) {
    case "teacher_appointed": return "Permanent and pensionable (teacher)";
    case "teacher_special": return "Permanent and pensionable (teacher with special responsibility)";
    case "ministry_permanent": return "Permanent and pensionable";
    case "ministry_temporary": return "Temporary employment";
    default: return "Employed";
  }
}

window.JobLetters = {
  findEmployeeByEmail,
  issueLetter,
  decodeAndVerify,
  renderLetterHtml,
  injectQrInto,
  downloadPdf,
  formatLongDate,
  formatDateTime,
  employmentLabel,
  escapeHtml,
  buildLetterBody,
};
