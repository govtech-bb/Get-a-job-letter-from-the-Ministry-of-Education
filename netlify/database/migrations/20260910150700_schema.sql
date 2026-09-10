-- Job Letters schema. Mirrors server/db/schema.sql (the local dev path);
-- this copy is what Netlify applies to the hosted database on deploy.

-- Job Letters service schema.
--
-- Two tables:
--   employees       — the source-of-truth dataset (in production this would be
--                     populated from the MoE service-records + SmartStream
--                     pipeline; here we seed it from data/employees-2000.json).
--   issued_letters  — an audit log of every letter generated, with the data
--                     snapshot taken at the time it was issued, plus the HMAC
--                     signature used in the verification URL.

CREATE TABLE IF NOT EXISTS employees (
  email             TEXT PRIMARY KEY,
  employee_id       TEXT,
  title             TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  pronoun           TEXT NOT NULL CHECK (pronoun IN ('he', 'she')),
  address           TEXT,
  letter_type       TEXT NOT NULL CHECK (letter_type IN (
                      'teacher_appointed', 'teacher_special', 'teacher_temporary',
                      'ministry_permanent', 'ministry_temporary'
                    )),
  post              TEXT NOT NULL,
  school            TEXT,
  employer          TEXT NOT NULL,
  appointment_date  DATE NOT NULL,
  monthly_salary    NUMERIC(10, 2) NOT NULL,
  monthly_allowance NUMERIC(10, 2),
  pay_frequency     TEXT NOT NULL DEFAULT 'monthly',
  is_acting         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issued_letters (
  id                 TEXT PRIMARY KEY,
  signature          TEXT NOT NULL,
  document_code      TEXT,
  recipient_email    TEXT NOT NULL,
  employee_snapshot  JSONB NOT NULL,
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until        TIMESTAMPTZ NOT NULL,
  email_message_id   TEXT,           -- Resend message id once sent
  email_status       TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_issued_letters_recipient
  ON issued_letters (recipient_email);
CREATE INDEX IF NOT EXISTS idx_issued_letters_issued_at
  ON issued_letters (issued_at DESC);


-- ---------------------------------------------------------------------------
-- Admin side
--
-- admins          — the allowlist. Only addresses in this table can sign in.
-- admin_codes     — one-time 6-digit codes sent to an admin email at login.
-- admin_sessions  — long-lived bearer tokens, set as an httpOnly cookie after
--                   the user proves they received the code.
-- employee_audit  — paper trail for every change to the employees table.

CREATE TABLE IF NOT EXISTS admins (
  email       TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_codes (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  attempts     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_codes_email   ON admin_codes (email);
CREATE INDEX IF NOT EXISTS idx_admin_codes_expires ON admin_codes (expires_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token         TEXT PRIMARY KEY,
  admin_email   TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent    TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_email   ON admin_sessions (admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS employee_audit (
  id             BIGSERIAL PRIMARY KEY,
  employee_email TEXT NOT NULL,
  action         TEXT NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'reactivate', 'delete')),
  changed_by     TEXT NOT NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before_data    JSONB,
  after_data     JSONB
);
CREATE INDEX IF NOT EXISTS idx_employee_audit_email ON employee_audit (employee_email);
CREATE INDEX IF NOT EXISTS idx_employee_audit_at    ON employee_audit (changed_at DESC);

CREATE TABLE IF NOT EXISTS allowed_domains (
  domain      TEXT PRIMARY KEY,
  added_by    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id           BIGSERIAL PRIMARY KEY,
  admin_email  TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('invite', 'update', 'deactivate', 'reactivate', 'delete')),
  changed_by   TEXT NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before_data  JSONB,
  after_data   JSONB
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_email ON admin_audit (admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_at    ON admin_audit (changed_at DESC);

-- ---------------------------------------------------------------------------
-- Verification audit trail
--
-- Logs every attempt to verify a letter via the public verify endpoint.
-- No PII is stored — the source IP is hashed so repeat-offenders can be
-- rate-limited without storing the raw address.

CREATE TABLE IF NOT EXISTS verification_attempts (
  id              BIGSERIAL PRIMARY KEY,
  letter_id       TEXT NOT NULL,
  source_hash     TEXT NOT NULL,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code_submitted  TEXT,
  result          TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'rate_limited', 'not_found'))
);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_letter
  ON verification_attempts (letter_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_source
  ON verification_attempts (source_hash, attempted_at DESC);

-- Lookups on the request form are by employee ID, not email.
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees (employee_id);
