-- Job Letters service schema.
--
-- Two tables:
--   employees       — the source-of-truth dataset (in production this would be
--                     populated from the MoE service-records + SmartStream
--                     pipeline; here we seed it from data/employees.json).
--   issued_letters  — an audit log of every letter generated, with the data
--                     snapshot taken at the time it was issued, plus the HMAC
--                     signature used in the verification URL.

CREATE TABLE IF NOT EXISTS employees (
  email             TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  pronoun           TEXT NOT NULL CHECK (pronoun IN ('he', 'she')),
  address           TEXT,
  letter_type       TEXT NOT NULL CHECK (letter_type IN (
                      'teacher_appointed', 'teacher_special',
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
