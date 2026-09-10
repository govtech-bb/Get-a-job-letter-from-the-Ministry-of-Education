// GET  /api/admin/employees                — list
// POST /api/admin/employees                — create
// GET  /api/admin/employees?email=X        — fetch one
// PUT  /api/admin/employees?email=X        — update
// POST /api/admin/employees?email=X&op=set-active   { isActive }
//
// All of these fold into a single function file. We dispatch by method
// + query parameters so we don't need separate route files for each verb.

import { requireAdmin } from "../../server/lib/adminAuth.js";
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, setEmployeeActive, getEmployeeAudit,
} from "../../server/lib/handlers/adminEmployees.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  await requireAdmin(req, res, async () => {
    try {
      const { email, op, audit } = req.query;
      const changedBy = req.admin.adminEmail;

      // POST /employees?email=X&op=set-active
      if (req.method === "POST" && email && op === "set-active") {
        const { isActive } = req.body || {};
        const r = await setEmployeeActive({ email, isActive: !!isActive, changedBy });
        return res.status(r.status).json(r.body);
      }

      // POST /employees → create
      if (req.method === "POST" && !email) {
        const r = await createEmployee({ body: req.body, changedBy });
        return res.status(r.status).json(r.body);
      }

      // PUT /employees?email=X → update
      if (req.method === "PUT" && email) {
        const r = await updateEmployee({ email, body: req.body, changedBy });
        return res.status(r.status).json(r.body);
      }

      // GET /employees?email=X&audit=1 → audit log for that employee
      if (req.method === "GET" && email && audit) {
        const rows = await getEmployeeAudit(email);
        return res.status(200).json({ audit: rows });
      }

      // GET /employees?email=X → one
      if (req.method === "GET" && email) {
        const e = await getEmployee(email);
        if (!e) return res.status(404).json({ error: "not_found" });
        return res.status(200).json({ employee: e });
      }

      // GET /employees → list
      if (req.method === "GET") {
        const data = await listEmployees({
          page: req.query.page, q: req.query.q,
          activeOnly: req.query.active === "1",
        });
        return res.status(200).json(data);
      }

      res.status(405).json({ error: "method_not_allowed" });
    } catch (err) {
      console.error("admin/employees:", err);
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });
}
