-- ── interviews table ────────────────────────────────────────────────────────
-- Interview scheduling system for HireSight
-- Tracks scheduled, completed, and cancelled interview rounds

CREATE TABLE IF NOT EXISTS interviews (
  id                  TEXT PRIMARY KEY,
  application_id      TEXT NOT NULL REFERENCES applications(id),
  job_id              TEXT NOT NULL REFERENCES jobs(id),
  hr_id               TEXT NOT NULL REFERENCES users(id),
  candidate_id        TEXT NOT NULL,
  scheduled_at        TEXT NOT NULL,
  duration_minutes    INTEGER NOT NULL DEFAULT 45,
  round_type          TEXT NOT NULL DEFAULT 'Technical Round',
  meeting_link        TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'scheduled',
  feedback            TEXT,
  rating              INTEGER,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interviews_app       ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_hr        ON interviews(hr_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled ON interviews(scheduled_at);
