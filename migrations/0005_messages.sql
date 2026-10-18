-- ── messages table ────────────────────────────────────────────────────────────
-- Recruiter → Candidate in-app messaging system.
-- from_user_id  : HR user sending the message
-- to_user_id    : Candidate user receiving the message
-- application_id: Optional context link to a specific application
-- read_at       : NULL until candidate opens/reads the message

CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  from_user_id   TEXT NOT NULL,
  to_user_id     TEXT NOT NULL,
  application_id TEXT,
  subject        TEXT NOT NULL,
  body           TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  read_at        TEXT,

  FOREIGN KEY (from_user_id)   REFERENCES users(id),
  FOREIGN KEY (to_user_id)     REFERENCES users(id),
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_to_user   ON messages(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id, created_at DESC);
