// One-shot setup script: creates the schema and seeds employees from
// data/employees.json. Idempotent — safe to re-run.
//
// Usage:
//   node server/db/migrate.js
//
// Reads DATABASE_URL from .env.local (or the environment). Uses `pg` for the
// migration because it's a one-off run on a node process; runtime queries use
// @neondatabase/serverless which is purpose-built for serverless.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";
const { Client } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") }); // fallback

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ...(!isLocal && { ssl: { rejectUnauthorized: false } }),
});

async function main() {
  console.log("→ Connecting…");
  await client.connect();
  const ping = await client.query("SELECT 1 AS ok");
  if (ping.rows[0].ok !== 1) throw new Error("Connection check failed");
  console.log("  Connected.");

  console.log("→ Applying schema…");
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await client.query(schemaSql);
  console.log("  Schema applied.");

  console.log("→ Running column migrations…");
  await client.query(`
    ALTER TABLE issued_letters ADD COLUMN IF NOT EXISTS document_code TEXT;
  `);
  console.log("  Column migrations done.");

  console.log("→ Seeding employees…");
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "employees.json"), "utf-8"));
  const employees = json.employees;
  let upserted = 0;
  for (const e of employees) {
    await client.query(
      `INSERT INTO employees (
         email, title, first_name, last_name, pronoun, address,
         letter_type, post, school, employer,
         appointment_date, monthly_salary, monthly_allowance,
         pay_frequency, is_acting, is_active
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13,
         $14, $15, $16
       )
       ON CONFLICT (email) DO UPDATE SET
         title             = EXCLUDED.title,
         first_name        = EXCLUDED.first_name,
         last_name         = EXCLUDED.last_name,
         pronoun           = EXCLUDED.pronoun,
         address           = EXCLUDED.address,
         letter_type       = EXCLUDED.letter_type,
         post              = EXCLUDED.post,
         school            = EXCLUDED.school,
         employer          = EXCLUDED.employer,
         appointment_date  = EXCLUDED.appointment_date,
         monthly_salary    = EXCLUDED.monthly_salary,
         monthly_allowance = EXCLUDED.monthly_allowance,
         pay_frequency     = EXCLUDED.pay_frequency,
         is_acting         = EXCLUDED.is_acting,
         is_active         = EXCLUDED.is_active,
         updated_at        = NOW()`,
      [
        e.email, e.title, e.firstName, e.lastName, e.pronoun, e.address,
        e.letterType, e.post, e.school, e.employer,
        e.appointmentDate, e.monthlySalary, e.monthlyAllowance,
        e.payFrequency, e.isActing, e.isActive,
      ]
    );
    upserted++;
  }
  console.log(`  Upserted ${upserted} employees.`);

  console.log("→ Seeding admins…");
  const admins = [
    { email: "abisola.fatokun@govtech.bb", name: "Abisola Fatokun", role: "super_admin" },
  ];
  for (const a of admins) {
    await client.query(
      `INSERT INTO admins (email, name, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [a.email, a.name, a.role]
    );
  }
  console.log(`  ${admins.length} admin(s) seeded.`);

  console.log("→ Seeding allowed domains…");
  const domains = ["moe.gov.bb"];
  for (const d of domains) {
    await client.query(
      `INSERT INTO allowed_domains (domain, added_by)
       VALUES ($1, 'migration')
       ON CONFLICT (domain) DO NOTHING`,
      [d]
    );
  }
  console.log(`  ${domains.length} domain(s) seeded.`);

  console.log("→ Verifying…");
  const counts = await client.query("SELECT COUNT(*)::int AS count FROM employees");
  console.log(`  ${counts.rows[0].count} employees in the table.`);
  const sample = await client.query(
    "SELECT email, first_name, last_name, letter_type FROM employees ORDER BY email LIMIT 6"
  );
  console.table(sample.rows);

  await client.end();
  console.log("\nDone.");
}

main().catch(async err => {
  console.error("Migration failed:", err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
