// CRUD + audit log for the employees table. Each write inserts a row into
// employee_audit (who, when, what action, before/after).

import { sql } from "../db.js";
import { isEmailFormat } from "../emailFormat.js";

const PAGE_SIZE = 50;

function rowToEmployee(r) {
  return {
    email: r.email,
    employeeId: r.employeeId || null,
    title: r.title,
    firstName: r.firstName,
    lastName: r.lastName,
    pronoun: r.pronoun,
    address: r.address,
    letterType: r.letterType,
    post: r.post,
    school: r.school,
    employer: r.employer,
    appointmentDate: r.appointmentDate,
    monthlySalary: r.monthlySalary != null ? Number(r.monthlySalary) : null,
    monthlyAllowance: r.monthlyAllowance != null ? Number(r.monthlyAllowance) : null,
    payFrequency: r.payFrequency,
    isActing: r.isActing,
    isActive: r.isActive,
  };
}

const SELECT_COLUMNS = `
  email, employee_id AS "employeeId", title,
  first_name AS "firstName", last_name AS "lastName",
  pronoun, address, letter_type AS "letterType",
  post, school, employer,
  to_char(appointment_date, 'YYYY-MM-DD') AS "appointmentDate",
  monthly_salary AS "monthlySalary",
  monthly_allowance AS "monthlyAllowance",
  pay_frequency AS "payFrequency",
  is_acting AS "isActing",
  is_active AS "isActive",
  updated_at AS "updatedAt"
`;

export async function listEmployees({ page = 1, q = "", activeOnly = false } = {}) {
  const sqlq = sql();
  const offset = Math.max(0, (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE);
  const search = `%${String(q || "").trim().toLowerCase()}%`;
  const hasSearch = String(q || "").trim().length > 0;

  let rows, total;
  if (hasSearch && activeOnly) {
    rows = await sqlq`SELECT email, title, first_name AS "firstName", last_name AS "lastName",
        letter_type AS "letterType", post, school,
        is_active AS "isActive", is_acting AS "isActing"
      FROM employees
      WHERE is_active = TRUE
        AND (LOWER(email) LIKE ${search}
          OR LOWER(first_name) LIKE ${search}
          OR LOWER(last_name) LIKE ${search}
          OR LOWER(post) LIKE ${search}
          OR LOWER(COALESCE(school,'')) LIKE ${search})
      ORDER BY last_name, first_name
      LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
    const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM employees
      WHERE is_active = TRUE
        AND (LOWER(email) LIKE ${search}
          OR LOWER(first_name) LIKE ${search}
          OR LOWER(last_name) LIKE ${search}
          OR LOWER(post) LIKE ${search}
          OR LOWER(COALESCE(school,'')) LIKE ${search});`;
    total = c.n;
  } else if (hasSearch) {
    rows = await sqlq`SELECT email, title, first_name AS "firstName", last_name AS "lastName",
        letter_type AS "letterType", post, school,
        is_active AS "isActive", is_acting AS "isActing"
      FROM employees
      WHERE LOWER(email) LIKE ${search}
         OR LOWER(first_name) LIKE ${search}
         OR LOWER(last_name) LIKE ${search}
         OR LOWER(post) LIKE ${search}
         OR LOWER(COALESCE(school,'')) LIKE ${search}
      ORDER BY last_name, first_name
      LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
    const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM employees
      WHERE LOWER(email) LIKE ${search}
         OR LOWER(first_name) LIKE ${search}
         OR LOWER(last_name) LIKE ${search}
         OR LOWER(post) LIKE ${search}
         OR LOWER(COALESCE(school,'')) LIKE ${search};`;
    total = c.n;
  } else if (activeOnly) {
    rows = await sqlq`SELECT email, title, first_name AS "firstName", last_name AS "lastName",
        letter_type AS "letterType", post, school,
        is_active AS "isActive", is_acting AS "isActing"
      FROM employees
      WHERE is_active = TRUE
      ORDER BY last_name, first_name
      LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
    const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM employees WHERE is_active = TRUE;`;
    total = c.n;
  } else {
    rows = await sqlq`SELECT email, title, first_name AS "firstName", last_name AS "lastName",
        letter_type AS "letterType", post, school,
        is_active AS "isActive", is_acting AS "isActing"
      FROM employees
      ORDER BY last_name, first_name
      LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
    const [c] = await sqlq`SELECT COUNT(*)::int AS n FROM employees;`;
    total = c.n;
  }

  return { rows, total, pageSize: PAGE_SIZE, page: Math.max(1, Number(page) || 1) };
}

export async function getEmployee(email) {
  const q = sql();
  const norm = String(email || "").trim().toLowerCase();
  const rows = await q`
    SELECT email, employee_id AS "employeeId", title,
           first_name AS "firstName", last_name AS "lastName",
           pronoun, address, letter_type AS "letterType", post, school, employer,
           to_char(appointment_date, 'YYYY-MM-DD') AS "appointmentDate",
           monthly_salary AS "monthlySalary",
           monthly_allowance AS "monthlyAllowance",
           pay_frequency AS "payFrequency",
           is_acting AS "isActing", is_active AS "isActive",
           updated_at AS "updatedAt"
    FROM employees WHERE LOWER(email) = ${norm} LIMIT 1;
  `;
  return rows[0] ? rowToEmployee(rows[0]) : null;
}

function normaliseInput(b) {
  const e = b || {};
  // Pull through fields, coerce numerics + booleans.
  return {
    email: String(e.email || "").trim().toLowerCase(),
    employeeId: e.employeeId ? String(e.employeeId).trim() : null,
    title: String(e.title || "").trim(),
    firstName: String(e.firstName || "").trim(),
    lastName: String(e.lastName || "").trim(),
    pronoun: e.pronoun === "he" || e.pronoun === "she" ? e.pronoun : null,
    address: e.address ? String(e.address).trim() : null,
    letterType: String(e.letterType || ""),
    post: String(e.post || "").trim(),
    school: e.school ? String(e.school).trim() : null,
    employer: String(e.employer || "Ministry of Education Transformation").trim(),
    appointmentDate: String(e.appointmentDate || ""),
    monthlySalary: e.monthlySalary === "" || e.monthlySalary == null ? null : Number(e.monthlySalary),
    monthlyAllowance: e.monthlyAllowance === "" || e.monthlyAllowance == null ? null : Number(e.monthlyAllowance),
    payFrequency: e.payFrequency === "bi-monthly" ? "bi-monthly" : "monthly",
    isActing: !!e.isActing,
    isActive: e.isActive !== false,
  };
}

function validate(input) {
  const errors = [];
  if (!isEmailFormat(input.email)) errors.push({ field: "email", message: "Valid email required." });
  if (!input.firstName) errors.push({ field: "firstName", message: "First name is required." });
  if (!input.lastName)  errors.push({ field: "lastName",  message: "Last name is required." });
  if (!input.title)     errors.push({ field: "title",     message: "Title is required." });
  if (!input.pronoun)   errors.push({ field: "pronoun",   message: "Pronoun must be 'he' or 'she'." });
  if (!["teacher_appointed","teacher_special","ministry_permanent","ministry_temporary"].includes(input.letterType)) {
    errors.push({ field: "letterType", message: "Choose a letter type." });
  }
  if (!input.post)  errors.push({ field: "post", message: "Post is required." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.appointmentDate)) errors.push({ field: "appointmentDate", message: "Date must be YYYY-MM-DD." });
  if (input.monthlySalary == null || isNaN(input.monthlySalary) || input.monthlySalary < 0) {
    errors.push({ field: "monthlySalary", message: "Monthly salary must be a positive number." });
  }
  if (input.letterType === "teacher_special") {
    if (input.monthlyAllowance == null || isNaN(input.monthlyAllowance) || input.monthlyAllowance <= 0) {
      errors.push({ field: "monthlyAllowance", message: "Allowance is required for this letter type." });
    }
  }
  if (input.letterType?.startsWith("teacher_") && !input.school) {
    errors.push({ field: "school", message: "School is required for teacher letter types." });
  }
  if (input.letterType?.startsWith("ministry_") && !input.address) {
    errors.push({ field: "address", message: "Address is required for ministry letter types." });
  }
  return errors;
}

async function recordAudit({ employeeEmail, action, changedBy, before, after }) {
  const q = sql();
  await q`
    INSERT INTO employee_audit (employee_email, action, changed_by, before_data, after_data)
    VALUES (${employeeEmail}, ${action}, ${changedBy},
            ${before ? JSON.stringify(before) : null},
            ${after ? JSON.stringify(after) : null});
  `;
}

export async function createEmployee({ body, changedBy }) {
  const input = normaliseInput(body);
  const errors = validate(input);
  if (errors.length) return { status: 400, body: { error: "validation", errors } };

  const q = sql();
  const existing = await q`SELECT email FROM employees WHERE LOWER(email) = ${input.email} LIMIT 1;`;
  if (existing[0]) return { status: 409, body: { error: "conflict", message: "An employee with that email already exists." } };

  await q`
    INSERT INTO employees (
      email, employee_id, title, first_name, last_name, pronoun, address,
      letter_type, post, school, employer,
      appointment_date, monthly_salary, monthly_allowance,
      pay_frequency, is_acting, is_active
    ) VALUES (
      ${input.email}, ${input.employeeId}, ${input.title}, ${input.firstName}, ${input.lastName}, ${input.pronoun}, ${input.address},
      ${input.letterType}, ${input.post}, ${input.school}, ${input.employer},
      ${input.appointmentDate}, ${input.monthlySalary}, ${input.monthlyAllowance},
      ${input.payFrequency}, ${input.isActing}, ${input.isActive}
    );
  `;
  await recordAudit({ employeeEmail: input.email, action: "create", changedBy, before: null, after: input });
  const created = await getEmployee(input.email);
  return { status: 201, body: { employee: created } };
}

export async function updateEmployee({ email, body, changedBy }) {
  const norm = String(email || "").trim().toLowerCase();
  const before = await getEmployee(norm);
  if (!before) return { status: 404, body: { error: "not_found" } };

  // Merge incoming changes onto the current row, then normalise + validate.
  const input = normaliseInput({ ...before, ...body, email: norm });
  const errors = validate(input);
  if (errors.length) return { status: 400, body: { error: "validation", errors } };

  const q = sql();
  await q`
    UPDATE employees SET
      employee_id       = ${input.employeeId},
      title             = ${input.title},
      first_name        = ${input.firstName},
      last_name         = ${input.lastName},
      pronoun           = ${input.pronoun},
      address           = ${input.address},
      letter_type       = ${input.letterType},
      post              = ${input.post},
      school            = ${input.school},
      employer          = ${input.employer},
      appointment_date  = ${input.appointmentDate},
      monthly_salary    = ${input.monthlySalary},
      monthly_allowance = ${input.monthlyAllowance},
      pay_frequency     = ${input.payFrequency},
      is_acting         = ${input.isActing},
      is_active         = ${input.isActive},
      updated_at        = NOW()
    WHERE LOWER(email) = ${norm};
  `;
  await recordAudit({
    employeeEmail: norm, action: "update", changedBy,
    before, after: input,
  });
  const after = await getEmployee(norm);
  return { status: 200, body: { employee: after } };
}

export async function setEmployeeActive({ email, isActive, changedBy }) {
  const norm = String(email || "").trim().toLowerCase();
  const before = await getEmployee(norm);
  if (!before) return { status: 404, body: { error: "not_found" } };
  if (before.isActive === isActive) return { status: 200, body: { employee: before } };

  const q = sql();
  await q`UPDATE employees SET is_active = ${isActive}, updated_at = NOW() WHERE LOWER(email) = ${norm};`;
  await recordAudit({
    employeeEmail: norm,
    action: isActive ? "reactivate" : "deactivate",
    changedBy, before, after: { ...before, isActive },
  });
  const after = await getEmployee(norm);
  return { status: 200, body: { employee: after } };
}

export async function getEmployeeAudit(email, { limit = 30 } = {}) {
  const q = sql();
  const norm = String(email || "").trim().toLowerCase();
  const rows = await q`
    SELECT id, action, changed_by AS "changedBy", changed_at AS "changedAt",
           before_data AS "before", after_data AS "after"
    FROM employee_audit
    WHERE LOWER(employee_email) = ${norm}
    ORDER BY changed_at DESC
    LIMIT ${limit};
  `;
  return rows;
}
