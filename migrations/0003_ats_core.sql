-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0003: ATS core — profiles, applications, status pipeline, audit log
--
-- Run locally:  wrangler d1 execute hiring_db --local  --file=./migrations/0003_ats_core.sql
-- Run remote:   wrangler d1 execute hiring_db --remote --file=./migrations/0003_ats_core.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add status to jobs (open / closed / draft).
--    Default 'open' so all existing jobs immediately surface in Browse Openings.
--    Validation of allowed values is enforced in application code — D1's
--    ALTER TABLE ADD COLUMN does not support CHECK constraints.
ALTER TABLE jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'open';


-- 2. Candidate profiles — one row per authenticated candidate user.
--
--    is_complete is computed by the server on every save:
--      is_complete = 1  when  phone IS NOT NULL AND phone != ''
--                        AND  location IS NOT NULL AND location != ''
--                        AND  (  (linkedin_url IS NOT NULL AND linkedin_url != '')
--                              OR (github_url  IS NOT NULL AND github_url  != '') )
CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id              TEXT PRIMARY KEY REFERENCES users(id),

  -- Contact & professional links
  phone                TEXT,
  linkedin_url         TEXT,
  github_url           TEXT,
  portfolio_url        TEXT,
  resume_url           TEXT,      -- URL to a hosted resume file (R2 or external).
                                  -- Separate from candidates.resume_text (the AI-scored text).

  -- Professional identity (all optional)
  headline             TEXT,      -- e.g. "Full-Stack Engineer · 3 yrs"
  bio                  TEXT,
  location             TEXT,      -- e.g. "Bengaluru, India"  [required for is_complete]

  -- ATS metadata (all optional)
  years_of_experience  INTEGER,
  skills               TEXT,      -- CSV: "TypeScript,React,Go"
  availability         TEXT,      -- immediate | 2_weeks | 1_month | not_looking
  preferred_role_type  TEXT,      -- full_time | part_time | contract | remote
  expected_salary      TEXT,      -- Free text: "₹15–20 LPA"

  -- Completeness flag.
  -- Stored as INTEGER 0/1 (D1 has no native boolean).
  -- Required: phone + location + (linkedin_url OR github_url).
  is_complete          INTEGER NOT NULL DEFAULT 0,

  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 3. Applications — unified pipeline table.
--    Covers both in-platform Browse Openings (source='browse')
--    and the external shareable apply link (source='link').
--
--    user_id is nullable: anonymous link applications have no account yet.
--    UNIQUE(user_id, job_id): SQLite allows multiple NULL values in a UNIQUE
--    column, so anonymous link applies are never blocked by this constraint —
--    only authenticated candidates are prevented from applying twice.
CREATE TABLE IF NOT EXISTS applications (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT REFERENCES users(id),      -- NULL for anonymous link applies
  job_id                   TEXT NOT NULL REFERENCES jobs(id),
  candidate_submission_id  TEXT REFERENCES candidates(id), -- FK to the AI-scoring record

  status           TEXT NOT NULL DEFAULT 'applied',
  -- allowed values: applied | under_review | shortlisted | interview | rejected | hired

  source           TEXT NOT NULL DEFAULT 'browse',
  -- allowed values: browse | link

  applied_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by_hr_id TEXT REFERENCES users(id),              -- NULL until an HR acts

  UNIQUE (user_id, job_id)
);


-- 4. Status-change audit log — one row per transition.
--    from_status is NULL for the initial 'applied' creation event.
CREATE TABLE IF NOT EXISTS application_status_log (
  id                TEXT PRIMARY KEY,
  application_id    TEXT NOT NULL REFERENCES applications(id),
  from_status       TEXT,          -- NULL on initial creation
  to_status         TEXT NOT NULL,
  changed_by_hr_id  TEXT REFERENCES users(id),  -- NULL for system-triggered events
  changed_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note              TEXT           -- Optional HR comment
);


-- 5. Indexes for common query patterns.
CREATE INDEX IF NOT EXISTS idx_applications_user_id     ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id      ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status      ON applications(status);
CREATE INDEX IF NOT EXISTS idx_status_log_application   ON application_status_log(application_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status              ON jobs(status);
