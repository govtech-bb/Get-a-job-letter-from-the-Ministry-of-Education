// Express app for the Job Letters service.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

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

import { requestLetter as apiRequestLetter } from "./lib/handlers/requestLetter.js";
import { verifyLetter as apiVerifyLetter } from "./lib/handlers/verifyLetter.js";
import {
  issueCode as adminIssueCode,
  verifyCode as adminVerifyCode,
  destroySession as adminDestroySession,
  buildSetCookie as adminBuildSetCookie,
  buildClearCookie as adminBuildClearCookie,
  tokenFromReq as adminTokenFromReq,
  requireAdmin,
} from "./lib/adminAuth.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

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
app.use(express.json({ limit: "2mb" }));

// Permissive CORS for the API endpoints during local dev. Vercel applies its
// own (tighter) CORS in the deployed /api/* handlers.
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.post("/api/request-letter", async (req, res) => {
  try {
    const baseUrl = req.body?.publicBaseUrl ||
      `${req.protocol}://${req.get("host")}`;
    const result = await apiRequestLetter({ email: req.body?.email, publicBaseUrl: baseUrl });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("request-letter:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

app.get("/api/verify-letter", async (req, res) => {
  try {
    const result = await apiVerifyLetter({ id: req.query.id, signature: req.query.t });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("verify-letter:", err);
    res.status(500).json({ valid: false, reason: "internal_error" });
  }
});

/* ---------- Admin API (mirrored to /api/admin/*.js for Vercel) ---------- */

app.post("/api/admin/login", async (req, res) => {
  try {
    const result = await adminIssueCode({ email: req.body?.email });
    if (!result.ok) return res.status(result.status || 400).json({ error: result.reason, detail: result.detail });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/login:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/admin/verify", async (req, res) => {
  try {
    const result = await adminVerifyCode({
      email: req.body?.email,
      code: req.body?.code,
      userAgent: req.headers["user-agent"] || null,
    });
    if (!result.ok) return res.status(result.status || 401).json({ error: result.reason });
    res.setHeader("Set-Cookie", adminBuildSetCookie(result.token, result.expiresAt));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/verify:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/admin/logout", async (req, res) => {
  try {
    await adminDestroySession(adminTokenFromReq(req));
    res.setHeader("Set-Cookie", adminBuildClearCookie());
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/logout:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.get("/api/admin/me", async (req, res) => {
  await requireAdmin(req, res, () => {
    res.status(200).json({
      email: req.admin.adminEmail,
      name: req.admin.name,
      role: req.admin.role,
    });
  });
});

app.get("/api/admin/dashboard", async (req, res) => {
  await requireAdmin(req, res, async () => {
    try {
      const { adminDashboardData } = await import("./lib/handlers/adminDashboard.js");
      const data = await adminDashboardData();
      res.status(200).json(data);
    } catch (err) {
      console.error("admin/dashboard:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
});

app.get("/api/admin/letters", async (req, res) => {
  await requireAdmin(req, res, async () => {
    try {
      const { listIssuedLetters } = await import("./lib/handlers/adminLetters.js");
      const data = await listIssuedLetters({
        page: req.query.page, q: req.query.q, status: req.query.status,
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("admin/letters:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
});

app.get("/api/admin/letter", async (req, res) => {
  await requireAdmin(req, res, async () => {
    try {
      const { getIssuedLetterDetail } = await import("./lib/handlers/adminLetters.js");
      const id = String(req.query.id || "");
      if (!id) return res.status(400).json({ error: "missing_id" });
      const letter = await getIssuedLetterDetail(id);
      if (!letter) return res.status(404).json({ error: "not_found" });
      res.status(200).json({ letter });
    } catch (err) {
      console.error("admin/letter:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
});

// Employees CRUD — mirrors /api/admin/employees.js for Vercel.
function employeesHandler(method) {
  return async (req, res) => {
    await requireAdmin(req, res, async () => {
      try {
        const m = await import("./lib/handlers/adminEmployees.js");
        const { email, op, audit } = req.query;
        const changedBy = req.admin.adminEmail;

        if (method === "POST" && email && op === "set-active") {
          const r = await m.setEmployeeActive({ email, isActive: !!req.body?.isActive, changedBy });
          return res.status(r.status).json(r.body);
        }
        if (method === "POST" && !email) {
          const r = await m.createEmployee({ body: req.body, changedBy });
          return res.status(r.status).json(r.body);
        }
        if (method === "PUT" && email) {
          const r = await m.updateEmployee({ email, body: req.body, changedBy });
          return res.status(r.status).json(r.body);
        }
        if (method === "GET" && email && audit) {
          const rows = await m.getEmployeeAudit(email);
          return res.status(200).json({ audit: rows });
        }
        if (method === "GET" && email) {
          const e = await m.getEmployee(email);
          if (!e) return res.status(404).json({ error: "not_found" });
          return res.status(200).json({ employee: e });
        }
        if (method === "GET") {
          const data = await m.listEmployees({
            page: req.query.page, q: req.query.q, activeOnly: req.query.active === "1",
          });
          return res.status(200).json(data);
        }
        res.status(405).json({ error: "method_not_allowed" });
      } catch (err) {
        console.error("admin/employees:", err);
        res.status(500).json({ error: "internal_error", message: err.message });
      }
    });
  };
}

app.get("/api/admin/employees", employeesHandler("GET"));
app.post("/api/admin/employees", employeesHandler("POST"));
app.put("/api/admin/employees", employeesHandler("PUT"));

// Admins management — mirrors /api/admin/admins.js for Vercel.
function adminsHandler(method) {
  return async (req, res) => {
    await requireAdmin(req, res, async () => {
      try {
        const m = await import("./lib/handlers/adminAdmins.js");
        const { email, audit } = req.query;
        const changedBy = req.admin.adminEmail;
        const isSuperAdmin = req.admin.role === "super_admin";

        if (method === "POST" && !email) {
          const r = await m.createAdmin({ body: req.body, changedBy, isSuperAdmin });
          return res.status(r.status).json(r.body);
        }
        if (method === "PUT" && email) {
          const r = await m.updateAdmin({ email, body: req.body, changedBy, isSuperAdmin });
          return res.status(r.status).json(r.body);
        }
        if (method === "GET" && email && audit) {
          const rows = await m.getAdminAudit(email);
          return res.status(200).json({ audit: rows });
        }
        if (method === "GET" && email) {
          const a = await m.getAdmin(email);
          if (!a) return res.status(404).json({ error: "not_found" });
          return res.status(200).json({ admin: a });
        }
        if (method === "GET") {
          const admins = await m.listAdmins();
          return res.status(200).json({ admins });
        }
        res.status(405).json({ error: "method_not_allowed" });
      } catch (err) {
        console.error("admin/admins:", err);
        res.status(500).json({ error: "internal_error", message: err.message });
      }
    });
  };
}

app.get("/api/admin/admins",  adminsHandler("GET"));
app.post("/api/admin/admins", adminsHandler("POST"));
app.put("/api/admin/admins",  adminsHandler("PUT"));

// Short verify URL — matches the vercel.json rewrite. The QR codes on the
// generated PDFs point at /v?id=...&t=...
app.get("/v", (req, res) => {
  res.sendFile(path.join(ROOT, "verify.html"));
});

// Serve the govbb design system bundle (CSS, fonts, images). Mounted at the
// URL root so that the CSS's relative font URLs (./assets/fonts/...) resolve.
app.use(express.static(path.join(ROOT, "dist"), { fallthrough: true }));

// Admin pages live under /admin/. Mount with directory index so /admin/
// serves admin/index.html (the dashboard).
app.use("/admin", express.static(path.join(ROOT, "admin"), {
  fallthrough: true,
  index: "index.html",
  extensions: ["html"],
}));

// Serve the static client (the same files that ship to GitHub Pages) so we
// can hit /request.html, /sent.html, /verify.html and have them call the
// local /api/* endpoints. The dynamic SSR routes below still win for "/" and
// the other Express-rendered URLs.
app.use(express.static(ROOT, {
  fallthrough: true,
  index: false,           // don't shadow the SSR `app.get("/")`
  extensions: ["html"],
}));

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
