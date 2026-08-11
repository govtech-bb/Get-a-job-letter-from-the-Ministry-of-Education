// CSV upload → diff preview → apply. Snapshot-based: the CSV represents the
// current roster. The system diffs it against the database and shows what
// would change before committing.

import { sql } from "../db.js";

// ── CSV parsing ────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (!lines.length) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

function parseLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let val = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i]; i++; }
      }
      if (line[i] === ",") i++;
      fields.push(val.trim());
    } else {
      const next = line.indexOf(",", i);
      if (next === -1) { fields.push(line.slice(i).trim()); break; }
      fields.push(line.slice(i, next).trim());
      i = next + 1;
    }
  }
  return fields;
}

// ── Header normalisation ───────────────────────────────────────────────────

const HEADER_MAP = {
  employee_id: "employeeId",  employeeid: "employeeId",  "employee id": "employeeId",
  email: "email",
  title: "title",
  first_name: "firstName",   firstname: "firstName",    "first name": "firstName",
  last_name: "lastName",     lastname: "lastName",      "last name": "lastName",
  pronoun: "pronoun",        sex: "pronoun",
  address: "address",
  letter_type: "letterType", lettertype: "letterType",  "letter type": "letterType",
  post: "post",              "position name": "post",   position: "post",
  school: "school",
  employer: "employer",
  appointment_date: "appointmentDate", appointmentdate: "appointmentDate",
  "appointment date": "appointmentDate", "hire date": "appointmentDate",
  monthly_salary: "monthlySalary",   monthlysalary: "monthlySalary",
  "monthly salary": "monthlySalary", "salary amount": "monthlySalary",
  monthly_allowance: "monthlyAllowance", monthlyallowance: "monthlyAllowance",
  "monthly allowance": "monthlyAllowance",
  pay_frequency: "payFrequency",     payfrequency: "payFrequency",
  "pay frequency": "payFrequency",
  is_acting: "isActing",    isacting: "isActing",      acting: "isActing",
};

function normaliseHeaders(rawHeaders) {
  return rawHeaders.map(h => {
    const key = h.toLowerCase().trim();
    return HEADER_MAP[key] || key;
  });
}

// ── Row normalisation ──────────────────────────────────────────────────────

const VALID_LETTER_TYPES = [
  "teacher_appointed", "teacher_special", "teacher_temporary",
  "ministry_permanent", "ministry_temporary",
];

function normaliseRow(raw) {
  const pronounRaw = String(raw.pronoun || "").toLowerCase().trim();
  let pronoun = null;
  if (pronounRaw === "she" || pronounRaw === "female" || pronounRaw === "f") pronoun = "she";
  else if (pronounRaw === "he" || pronounRaw === "male" || pronounRaw === "m") pronoun = "he";

  const salaryRaw = String(raw.monthlySalary || "").replace(/[$,]/g, "");
  const allowanceRaw = String(raw.monthlyAllowance || "").replace(/[$,]/g, "");

  const actingRaw = String(raw.isActing || "").toLowerCase().trim();
  const isActing = actingRaw === "true" || actingRaw === "yes" || actingRaw === "1" || actingRaw === "y";

  return {
    employeeId: String(raw.employeeId || "").trim(),
    email: String(raw.email || "").trim().toLowerCase(),
    title: String(raw.title || "").trim(),
    firstName: String(raw.firstName || "").trim(),
    lastName: String(raw.lastName || "").trim(),
    pronoun,
    address: raw.address ? String(raw.address).trim() : null,
    letterType: String(raw.letterType || "").trim(),
    post: String(raw.post || "").trim(),
    school: raw.school ? String(raw.school).trim() : null,
    employer: String(raw.employer || "Ministry of Education Transformation").trim(),
    appointmentDate: normaliseDate(raw.appointmentDate),
    monthlySalary: salaryRaw ? Number(salaryRaw) : null,
    monthlyAllowance: allowanceRaw ? Number(allowanceRaw) : null,
    payFrequency: String(raw.payFrequency || "monthly").trim().toLowerCase(),
    isActing,
  };
}

function normaliseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or MM/DD/YYYY — try to parse
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ── Row validation ─────────────────────────────────────────────────────────

function validateRow(row, lineNum) {
  const errors = [];
  if (!row.employeeId) errors.push("Employee ID is required");
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Valid email is required");
  if (!row.firstName) errors.push("First name is required");
  if (!row.lastName) errors.push("Last name is required");
  if (!row.title) errors.push("Title is required");
  if (!row.pronoun) errors.push("Pronoun must be he/she (or male/female)");
  if (!VALID_LETTER_TYPES.includes(row.letterType)) errors.push(`Letter type must be one of: ${VALID_LETTER_TYPES.join(", ")}`);
  if (!row.post) errors.push("Post is required");
  if (!row.appointmentDate) errors.push("Appointment date is required (YYYY-MM-DD)");
  if (row.monthlySalary == null || isNaN(row.monthlySalary) || row.monthlySalary < 0) errors.push("Monthly salary must be a positive number");
  if (row.letterType?.startsWith("teacher_") && !row.school) errors.push("School is required for teacher letter types");
  if (row.letterType === "teacher_special" && (row.monthlyAllowance == null || row.monthlyAllowance <= 0)) {
    errors.push("Monthly allowance is required for teacher_special letter type");
  }

  if (errors.length) return { line: lineNum, employeeId: row.employeeId, name: `${row.firstName} ${row.lastName}`, errors };
  return null;
}

// ── Diff computation ───────────────────────────────────────────────────────

const COMPARE_FIELDS = [
  "email", "title", "firstName", "lastName", "pronoun", "address",
  "letterType", "post", "school", "employer", "appointmentDate",
  "monthlySalary", "monthlyAllowance", "payFrequency", "isActing",
];

function diffEmployee(csvRow, dbRow) {
  const changes = [];
  for (const field of COMPARE_FIELDS) {
    const csvVal = csvRow[field];
    const dbVal = dbRow[field];
    const a = csvVal == null ? "" : String(csvVal);
    const b = dbVal == null ? "" : String(dbVal);
    if (a !== b) {
      changes.push({ field, from: dbVal, to: csvVal });
    }
  }
  return changes;
}

// ── Preview (parse + diff, no writes) ──────────────────────────────────────

export async function previewUpload(csvText) {
  const { headers: rawHeaders, rows: rawRows } = parseCSV(csvText);
  if (!rawRows.length) return { error: "The CSV file is empty or has no data rows." };

  const headers = normaliseHeaders(rawHeaders);
  if (!headers.includes("employeeId")) {
    return { error: "CSV must have an 'employee_id' (or 'Employee ID') column." };
  }

  // Re-key the raw rows using normalised headers
  const rows = rawRows.map(rawRow => {
    const mapped = {};
    for (const [key, val] of Object.entries(rawRow)) {
      const normKey = HEADER_MAP[key.toLowerCase().trim()] || key;
      mapped[normKey] = val;
    }
    return normaliseRow(mapped);
  });

  // Validate
  const validationErrors = [];
  const validRows = [];
  for (let i = 0; i < rows.length; i++) {
    const err = validateRow(rows[i], i + 2); // +2 for 1-indexed header row
    if (err) validationErrors.push(err);
    else validRows.push(rows[i]);
  }

  // Check for duplicate employee IDs in the CSV
  const seen = new Map();
  for (const row of validRows) {
    if (seen.has(row.employeeId)) {
      validationErrors.push({
        line: null,
        employeeId: row.employeeId,
        name: `${row.firstName} ${row.lastName}`,
        errors: [`Duplicate employee ID in CSV (also appears for ${seen.get(row.employeeId)})`],
      });
    } else {
      seen.set(row.employeeId, `${row.firstName} ${row.lastName}`);
    }
  }

  if (validationErrors.length) {
    return { error: "validation", validationErrors, totalRows: rawRows.length };
  }

  // Fetch all current active employees from DB
  const q = sql();
  const dbRows = await q`
    SELECT employee_id AS "employeeId",
           email, title, first_name AS "firstName", last_name AS "lastName",
           pronoun, address, letter_type AS "letterType",
           post, school, employer,
           to_char(appointment_date, 'YYYY-MM-DD') AS "appointmentDate",
           monthly_salary::float8 AS "monthlySalary",
           monthly_allowance::float8 AS "monthlyAllowance",
           pay_frequency AS "payFrequency",
           is_acting AS "isActing",
           is_active AS "isActive"
    FROM employees
    WHERE is_active = TRUE;
  `;

  const dbMap = new Map();
  for (const row of dbRows) dbMap.set(row.employeeId, row);

  const csvIds = new Set(validRows.map(r => r.employeeId));

  const added = [];
  const updated = [];
  const unchanged = [];
  const removed = [];

  for (const csvRow of validRows) {
    const dbRow = dbMap.get(csvRow.employeeId);
    if (!dbRow) {
      added.push({ employee: csvRow });
    } else {
      const changes = diffEmployee(csvRow, dbRow);
      if (changes.length) {
        updated.push({ employee: csvRow, changes });
      } else {
        unchanged.push({ employeeId: csvRow.employeeId, name: `${csvRow.firstName} ${csvRow.lastName}` });
      }
    }
  }

  for (const dbRow of dbRows) {
    if (!csvIds.has(dbRow.employeeId)) {
      removed.push({
        employeeId: dbRow.employeeId,
        name: `${dbRow.title} ${dbRow.firstName} ${dbRow.lastName}`,
        email: dbRow.email,
        post: dbRow.post,
        school: dbRow.school,
      });
    }
  }

  return {
    summary: {
      total: validRows.length,
      added: added.length,
      updated: updated.length,
      unchanged: unchanged.length,
      removed: removed.length,
    },
    added,
    updated,
    unchanged,
    removed,
  };
}

// ── Apply (commit the diff) ────────────────────────────────────────────────

export async function applyUpload(csvText, changedBy) {
  const preview = await previewUpload(csvText);
  if (preview.error) return { status: 400, body: preview };

  const q = sql();
  let insertCount = 0, updateCount = 0, deactivateCount = 0;

  // Inserts
  for (const { employee: e } of preview.added) {
    await q`
      INSERT INTO employees (
        employee_id, email, title, first_name, last_name, pronoun, address,
        letter_type, post, school, employer,
        appointment_date, monthly_salary, monthly_allowance,
        pay_frequency, is_acting, is_active
      ) VALUES (
        ${e.employeeId}, ${e.email}, ${e.title}, ${e.firstName}, ${e.lastName},
        ${e.pronoun}, ${e.address}, ${e.letterType}, ${e.post}, ${e.school},
        ${e.employer}, ${e.appointmentDate}, ${e.monthlySalary},
        ${e.monthlyAllowance}, ${e.payFrequency}, ${e.isActing}, TRUE
      )
      ON CONFLICT (employee_id) DO UPDATE SET
        email = EXCLUDED.email, title = EXCLUDED.title,
        first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
        pronoun = EXCLUDED.pronoun, address = EXCLUDED.address,
        letter_type = EXCLUDED.letter_type, post = EXCLUDED.post,
        school = EXCLUDED.school, employer = EXCLUDED.employer,
        appointment_date = EXCLUDED.appointment_date,
        monthly_salary = EXCLUDED.monthly_salary,
        monthly_allowance = EXCLUDED.monthly_allowance,
        pay_frequency = EXCLUDED.pay_frequency,
        is_acting = EXCLUDED.is_acting, is_active = TRUE,
        updated_at = NOW();
    `;
    await recordAudit(q, {
      employeeEmail: e.email, action: "create", changedBy,
      before: null, after: e,
    });
    insertCount++;
  }

  // Updates
  for (const { employee: e } of preview.updated) {
    const before = preview.updated.find(u => u.employee.employeeId === e.employeeId);
    await q`
      UPDATE employees SET
        email = ${e.email}, title = ${e.title},
        first_name = ${e.firstName}, last_name = ${e.lastName},
        pronoun = ${e.pronoun}, address = ${e.address},
        letter_type = ${e.letterType}, post = ${e.post},
        school = ${e.school}, employer = ${e.employer},
        appointment_date = ${e.appointmentDate},
        monthly_salary = ${e.monthlySalary},
        monthly_allowance = ${e.monthlyAllowance},
        pay_frequency = ${e.payFrequency},
        is_acting = ${e.isActing}, is_active = TRUE,
        updated_at = NOW()
      WHERE employee_id = ${e.employeeId};
    `;
    await recordAudit(q, {
      employeeEmail: e.email, action: "update", changedBy,
      before: before?.changes, after: e,
    });
    updateCount++;
  }

  // Deactivations (soft delete)
  for (const r of preview.removed) {
    await q`
      UPDATE employees SET is_active = FALSE, updated_at = NOW()
      WHERE employee_id = ${r.employeeId};
    `;
    await recordAudit(q, {
      employeeEmail: r.email, action: "deactivate", changedBy,
      before: { employeeId: r.employeeId, isActive: true },
      after: { employeeId: r.employeeId, isActive: false },
    });
    deactivateCount++;
  }

  return {
    status: 200,
    body: {
      applied: true,
      inserted: insertCount,
      updated: updateCount,
      deactivated: deactivateCount,
      unchanged: preview.unchanged.length,
    },
  };
}

async function recordAudit(q, { employeeEmail, action, changedBy, before, after }) {
  await q`
    INSERT INTO employee_audit (employee_email, action, changed_by, before_data, after_data)
    VALUES (${employeeEmail}, ${action}, ${changedBy},
            ${before ? JSON.stringify(before) : null},
            ${after ? JSON.stringify(after) : null});
  `;
}
