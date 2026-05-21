// Express app for the Job Letters service.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { layout } from "./views/layout.js";
import {
  startPage,
  requestPage,
  sentPage,
  notFoundPage,
  letterReadyPage,
  verifyPage,
  genericInfoPage,
} from "./views/pages.js";
import { issueLetter, getLetter, verifyLetter } from "./letterStore.js";
import { buildLetterPreviewHtml } from "./letterTemplates.js";
import { generateLetterPdf } from "./pdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load synthetic employee dataset
const employeesPath = path.join(ROOT, "data", "employees.json");
const employeesFile = JSON.parse(fs.readFileSync(employeesPath, "utf-8"));
const employees = employeesFile.employees;

function findEmployeeByEmail(email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle) return null;
  return employees.find(e => e.email.toLowerCase() === needle) || null;
}

const app = express();
app.use(express.urlencoded({ extended: false }));

// Serve the govbb design system bundle (CSS, fonts, images). Mounted at the
// URL root so that the CSS's relative font URLs (./assets/fonts/...) resolve.
app.use(express.static(path.join(ROOT, "dist"), { fallthrough: true }));

function send(res, title, main, opts = {}) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(layout({ title, main, ...opts }));
}

// Start page
app.get("/", (req, res) => {
  send(res, "Get a job letter", startPage(), { banner: "alpha" });
});

// Request flow — email entry
app.get("/request", (req, res) => {
  send(res, "What is your work email address?", requestPage(), {
    breadcrumbs: [
      { label: "Job letters", href: "/" },
      { label: "Your email" },
    ],
  });
});

app.post("/request", (req, res) => {
  const email = String(req.body.email || "").trim();
  if (!email) {
    return send(res, "What is your work email address?",
      requestPage({ error: "Enter your work email address", email }), {
        breadcrumbs: [{ label: "Job letters", href: "/" }, { label: "Your email" }],
      });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return send(res, "What is your work email address?",
      requestPage({ error: "Enter an email address in the correct format, for example name@moe.gov.bb", email }), {
        breadcrumbs: [{ label: "Job letters", href: "/" }, { label: "Your email" }],
      });
  }

  const employee = findEmployeeByEmail(email);
  if (!employee || !employee.isActive) {
    return send(res, "We could not find a record", notFoundPage({ email }), {
      breadcrumbs: [
        { label: "Job letters", href: "/" },
        { label: "Your email", href: "/request" },
        { label: "No record found" },
      ],
    });
  }

  const letter = issueLetter(employee);
  const letterUrl = `/letter/${letter.id}?t=${letter.token}`;
  send(res, "Your letter is on its way", sentPage({ email, letterUrl }), {
    breadcrumbs: [
      { label: "Job letters", href: "/" },
      { label: "Your email", href: "/request" },
      { label: "Letter sent" },
    ],
  });
});

// Letter ready view (after request, link in the demo "email")
app.get("/letter/:id", async (req, res) => {
  const letter = getLetter(req.params.id);
  const token = String(req.query.t || "");
  if (!letter || letter.token !== token) {
    return res.status(404).send(layout({
      title: "Letter not found",
      main: genericInfoPage({
        title: "We could not find that letter",
        body: "<p>The link may be wrong or the letter may have been removed.</p>",
      }),
    }));
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const verifyUrl = `${baseUrl}/verify/${letter.id}?t=${letter.token}`;
  letter.verifyUrl = verifyUrl; // attach for templates that need it
  const downloadUrl = `/letter/${letter.id}/download?t=${letter.token}`;
  const previewHtml = buildLetterPreviewHtml(letter);

  send(res, "Your letter", letterReadyPage({ letter, downloadUrl, verifyUrl, previewHtml }), {
    breadcrumbs: [
      { label: "Job letters", href: "/" },
      { label: "Your letter" },
    ],
  });
});

// PDF download
app.get("/letter/:id/download", async (req, res) => {
  const letter = getLetter(req.params.id);
  const token = String(req.query.t || "");
  if (!letter || letter.token !== token) {
    return res.status(404).send("Letter not found");
  }
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  letter.verifyUrl = `${baseUrl}/verify/${letter.id}?t=${letter.token}`;
  const pdfBytes = await generateLetterPdf(letter);
  const filename = `Job-Letter-${letter.employee.firstName}-${letter.employee.lastName}-${letter.id}.pdf`
    .replace(/[^A-Za-z0-9.\-]/g, "_");
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(pdfBytes));
});

// Public verification page (the QR code points here)
app.get("/verify/:id", (req, res) => {
  const id = req.params.id;
  const token = String(req.query.t || "");
  const result = verifyLetter(id, token);
  send(res, result.valid ? "Letter verified" : "Verification failed", verifyPage(result), {
    breadcrumbs: [
      { label: "Job letters", href: "/" },
      { label: "Verify a letter" },
    ],
  });
});

// Static info pages
app.get("/privacy", (req, res) => {
  send(res, "Privacy notice", genericInfoPage({
    title: "Privacy notice",
    body: `
      <p class="govbb-text-body">
        This alpha runs on synthetic data only — no real employee information is held.
        For production, the Ministry will publish a full privacy notice covering the
        legal basis for processing, retention, and rights under the Barbados Data
        Protection Act.
      </p>
      <h2 class="govbb-text-h3">What we collect</h2>
      <ul class="govbb-list govbb-list--bullet">
        <li>The work email you submit, to match against the Ministry record.</li>
        <li>The letter reference and verification token, so a recipient can check the letter is genuine.</li>
      </ul>
      <h2 class="govbb-text-h3">Where the data is held</h2>
      <p class="govbb-text-body">
        Hosting is on Public Digital's AWS Canada infrastructure. Data does not leave
        the hosting region. We only display salary in the letter itself, never on the
        public verification page.
      </p>
    `,
  }), { breadcrumbs: [{ label: "Job letters", href: "/" }, { label: "Privacy notice" }] });
});

app.get("/accessibility", (req, res) => {
  send(res, "Accessibility", genericInfoPage({
    title: "Accessibility statement",
    body: `
      <p class="govbb-text-body">
        This service uses the GovBB design system and aims to meet WCAG 2.2 level AA.
      </p>
      <h2 class="govbb-text-h3">How the service is built</h2>
      <ul class="govbb-list govbb-list--bullet">
        <li>Pages are plain HTML and work without JavaScript.</li>
        <li>Forms have visible labels, hint text and error messages associated by ID.</li>
        <li>Colour contrast follows the design system tokens.</li>
        <li>The service can be used with a keyboard alone.</li>
      </ul>
      <h2 class="govbb-text-h3">Get in touch</h2>
      <p class="govbb-text-body">If you have feedback, contact the Ministry's Personnel Department.</p>
    `,
  }), { breadcrumbs: [{ label: "Job letters", href: "/" }, { label: "Accessibility" }] });
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Job Letters service listening on http://localhost:${port}`);
});
