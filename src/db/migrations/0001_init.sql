CREATE TABLE IF NOT EXISTS applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'claimed', 'approved', 'denied_requirements', 'denied_expectations', 'cancelled')),
  answers      TEXT    NOT NULL DEFAULT '{}',
  thread_id    TEXT,
  claimed_by   TEXT,
  claimed_at   INTEGER,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_applicant_status
  ON applications (applicant_id, status);

CREATE INDEX IF NOT EXISTS idx_applications_status
  ON applications (status);

CREATE TABLE IF NOT EXISTS decisions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications (id),
  staff_id       TEXT    NOT NULL,
  action         TEXT    NOT NULL,
  note           TEXT,
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_staff_created
  ON decisions (staff_id, created_at);

CREATE TABLE IF NOT EXISTS guild_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
