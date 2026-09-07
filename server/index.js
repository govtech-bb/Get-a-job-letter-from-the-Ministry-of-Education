// Express app for the Job Letters service.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";


import { issueLetter, getLetter } from "./letterStore.js";
import { generateLetterPdf } from "./pdf.js";
import { findIssuedLetter } from "./lib/db.js";
import { requestLetter as apiRequestLetter } from "./lib/handlers/requestLetter.js";
import { verifyLetter as apiVerifyLetter, challengeLetter as apiChallengeLetter } from "./lib/handlers/verifyLetter.js";
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
const employeesPath = path.join(ROOT, "data", "employees-2000.json");
const employeesFile = JSON.parse(fs.readFileSync(employeesPath, "utf-8"));
const employees = employeesFile.employees;

function findEmployeeByEmployeeId(employeeId) {
  const needle = String(employeeId || "").trim();
  if (!needle) return null;
  return employees.find(e => e.employeeId === needle) || null;
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
    const { firstName, lastName, employeeId, email } = req.body || {};

    if (process.env.DATABASE_URL) {
      const result = await apiRequestLetter({ firstName, lastName, employeeId, email, publicBaseUrl: baseUrl });
      return res.status(result.status).json(result.body);
    }

    // Local dev fallback: use in-memory JSON data instead of the database.
    const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors = [];
    if (!firstName?.trim()) errors.push({ field: "firstName", message: "Enter your first name" });
    if (!lastName?.trim()) errors.push({ field: "lastName", message: "Enter your last name" });
    if (!employeeId?.trim()) errors.push({ field: "employeeId", message: "Enter your employee ID" });
    if (!email || !EMAIL_RX.test(email)) {
      errors.push({ field: "email", message: "Enter a valid email address" });
    }
    if (errors.length) return res.status(400).json({ error: "validation", errors });

    const local = email.split("@")[0].toLowerCase();
    const fNorm = firstName.trim().toLowerCase();
    const lNorm = lastName.trim().toLowerCase();
    const lastParts = lNorm.split(/[-']/).filter(Boolean);
    const nameParts = [fNorm, ...lastParts];
    if (!nameParts.some(p => p.length >= 2 && local.includes(p))) {
      return res.status(400).json({
        error: "validation",
        errors: [{ field: "email", message: "Your email address does not appear to match the name you entered" }],
      });
    }

    const employee = findEmployeeByEmployeeId(employeeId.trim());
    if (!employee || !employee.isActive) {
      return res.status(404).json({ error: "not_found", message: "We could not find a record for that employee ID." });
    }
    if (fNorm !== employee.firstName.toLowerCase() || lNorm !== employee.lastName.toLowerCase()) {
      return res.status(404).json({ error: "not_found", message: "The name you entered does not match the record for that employee ID." });
    }

    const letter = issueLetter(employee);
    return res.status(200).json({ ok: true, letterId: letter.id, letterToken: letter.token });
  } catch (err) {
    console.error("request-letter:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

app.get("/api/verify-letter", async (req, res) => {
  try {
    const sourceIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
    const result = await apiVerifyLetter({ id: req.query.id, signature: req.query.t, sourceIp });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("verify-letter:", err);
    res.status(500).json({ valid: false, reason: "internal_error" });
  }
});

app.post("/api/verify-challenge", async (req, res) => {
  try {
    const sourceIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
    const { id, t: signature, code } = req.body || {};
    const result = await apiChallengeLetter({ id, signature, code, sourceIp });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("verify-challenge:", err);
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

// Employee CSV upload — super_admin only
app.post("/api/admin/employees/upload-preview", async (req, res) => {
  await requireAdmin(req, res, async () => {
    try {
      if (req.admin.role !== "super_admin") return res.status(403).json({ error: "forbidden" });
      const { previewUpload } = await import("./lib/handlers/adminUpload.js");
      const csv = req.body?.csv;
      if (!csv) return res.status(400).json({ error: "No CSV data provided." });
      const result = await previewUpload(csv);
      if (result.error && result.error !== "validation") return res.status(400).json(result);
      if (result.error === "validation") return res.status(422).json(result);
      res.status(200).json(result);
    } catch (err) {
      console.error("admin/upload-preview:", err);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });
});

app.post("/api/admin/employees/upload-apply", async (req, res) => {
  await requireAdmin(req, res, async () => {
    try {
      if (req.admin.role !== "super_admin") return res.status(403).json({ error: "forbidden" });
      const { applyUpload } = await import("./lib/handlers/adminUpload.js");
      const csv = req.body?.csv;
      if (!csv) return res.status(400).json({ error: "No CSV data provided." });
      const result = await applyUpload(csv, req.admin.adminEmail);
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error("admin/upload-apply:", err);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });
});

app.get("/api/admin/employees/template.csv", async (req, res) => {
  await requireAdmin(req, res, () => {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=employee-template.csv");
    res.send(
      "employee_id,email,title,first_name,last_name,pronoun,letter_type,post,school,employer,appointment_date,monthly_salary,monthly_allowance,pay_frequency,address,is_acting\n" +
      '123456-0001,jane.doe@moe.gov.bb,Ms.,Jane,Doe,she,teacher_appointed,Graduate Teacher,Alleyne School,Ministry of Education Transformation,2019-09-01,5965.60,,monthly,,false\n'
    );
  });
});

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

// Allowed domains — public read, admin write
app.get("/api/allowed-domains", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ domains: [{ domain: "gov.bb" }] });
    }
    const { getDomains } = await import("./lib/handlers/adminSettings.js");
    const result = await getDomains();
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("allowed-domains:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

function settingsHandler(method) {
  return async (req, res) => {
    await requireAdmin(req, res, async () => {
      try {
        const m = await import("./lib/handlers/adminSettings.js");
        const changedBy = req.admin.adminEmail;
        const isSuperAdmin = req.admin.role === "super_admin";

        if (method === "GET") {
          const r = await m.getDomains();
          return res.status(r.status).json(r.body);
        }
        if (method === "POST") {
          const r = await m.addDomain({ domain: req.body?.domain, changedBy, isSuperAdmin });
          return res.status(r.status).json(r.body);
        }
        if (method === "DELETE") {
          const r = await m.deleteDomain({ domain: req.query.domain, changedBy, isSuperAdmin });
          return res.status(r.status).json(r.body);
        }
        res.status(405).json({ error: "method_not_allowed" });
      } catch (err) {
        console.error("admin/settings/domains:", err);
        res.status(500).json({ error: "internal_error", message: err.message });
      }
    });
  };
}

app.get("/api/admin/settings/domains", settingsHandler("GET"));
app.post("/api/admin/settings/domains", settingsHandler("POST"));
app.delete("/api/admin/settings/domains", settingsHandler("DELETE"));

// DEV ONLY — this route exists on the local server and has no Vercel
// counterpart, so it is not part of the deployed service. In production the
// letter reaches the employee as a PDF attached to the email that
// lib/handlers/requestLetter.js sends. This is here so you can look at a
// generated PDF while working without going through a mailbox.
//
// sent.html only shows the download button when the API is same-origin
// localhost, so this cannot turn into a link that 404s once deployed.
app.get("/letter/:id/download", async (req, res) => {
  const token = String(req.query.t || "");
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  // In-memory store first (no DATABASE_URL), then the database.
  let letter = getLetter(req.params.id);
  if (letter) {
    if (letter.token !== token) return res.status(404).send("Letter not found");
    letter.verifyUrl = `${baseUrl}/v?id=${encodeURIComponent(letter.id)}&t=${encodeURIComponent(letter.token)}`;
  } else if (process.env.DATABASE_URL) {
    const row = await findIssuedLetter(req.params.id);
    if (!row || row.signature !== token) return res.status(404).send("Letter not found");
    const { formatDocumentCode } = await import("./lib/fingerprint.js");
    letter = {
      id: row.id,
      employee: typeof row.employee === "string" ? JSON.parse(row.employee) : row.employee,
      issuedAt: row.issuedAt,
      validUntil: row.validUntil,
      verifyUrl: `${baseUrl}/v?id=${encodeURIComponent(row.id)}&t=${encodeURIComponent(row.signature)}`,
      documentCode: row.documentCode ? formatDocumentCode(row.documentCode) : null,
    };
  } else {
    return res.status(404).send("Letter not found");
  }

  const pdfBytes = await generateLetterPdf(letter);
  const filename = `Job-Letter-${letter.employee.firstName}-${letter.employee.lastName}-${letter.id}.pdf`
    .replace(/[^A-Za-z0-9.\-]/g, "_");
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(pdfBytes));
});

// Short verify URL — the QR codes on the generated PDFs point at
// /v?id=...&t=... In production this is a rewrite in vercel.json, so mirror
// that here: rewrite the path and let the static middleware below serve it.
// The URL the user sees stays /v, edits to verify.html are picked up without a
// restart, and this handler touches the filesystem itself not at all.
app.get("/v", (req, res, next) => {
  const q = req.url.indexOf("?");
  req.url = "/verify.html" + (q === -1 ? "" : req.url.slice(q));
  next();
});

// Admin pages live under /admin/. Mount with directory index so /admin/
// serves admin/index.html (the dashboard).
app.use("/admin", express.static(path.join(ROOT, "admin"), {
  fallthrough: true,
  index: "index.html",
  extensions: ["html"],
}));

// Serve the static client — the same files GitHub Pages ships — so local dev
// exercises exactly what production serves, calling the local /api/* endpoints
// instead of the deployed ones.
app.use(express.static(ROOT, {
  fallthrough: true,
  index: "index.html",
  extensions: ["html"],
}));

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Job Letters service listening on http://localhost:${port}`);
});
