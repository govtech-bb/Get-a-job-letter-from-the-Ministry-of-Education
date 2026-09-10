// GET /api/admin/employees/template.csv — the CSV header row plus one example
// record, for admins preparing an upload. Mirrors the route in server/index.js.

import { requireAdmin } from "../../server/lib/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  await requireAdmin(req, res, () => {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=employee-template.csv");
    res.status(200).send(
      "employee_id,email,title,first_name,last_name,pronoun,letter_type,post,school,employer,appointment_date,monthly_salary,monthly_allowance,pay_frequency,address,is_acting\n" +
      '123456-0001,jane.doe@moe.gov.bb,Ms.,Jane,Doe,she,teacher_appointed,Graduate Teacher,Alleyne School,Ministry of Education Transformation,2019-09-01,5965.60,,monthly,,false\n'
    );
  });
}
