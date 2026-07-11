# Changelog

All notable changes to HireSight are documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- `GET /api/jobs` public endpoint — candidate job board at `/jobs`
- `JobsBoard` React page: search, applicant count, "Apply Now" per listing
- `GET /api/candidates/my-applications` endpoint (requires candidate JWT)
- `CandidateDashboard` route wired and protected
- `HRDashboard` route wired and protected (`/hr/dashboard`)
- Auth routes mounted in Worker entry (`/api/auth/*`)
- `RBAC` middleware enforced on all protected routes server-side
- `MIT LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.env.example`
- `docs/architecture.md` — ERD, auth flow, technical decisions

### Fixed
- `JWT_SECRET` hardcoded fallback removed from all auth handlers — fails fast if secret is not set
- CORS `allowHeaders` updated to include `Authorization`
- WebSocket leaderboard now validates HR JWT via `?token=` query param
- `HRDashboard` response parsing corrected (`{ jobs: [] }` shape)
- Dashboard back-link now routes to `/hr/dashboard` instead of `/`

### Security
- All five server-side RBAC gaps closed (see Phase 2.5 audit)
- `JWT_SECRET` default fallback eliminated across five handler files

---

## [0.4.0] — 2026-06-22 · Role-Based Access & Portals

> Commit range: `04b4de3` ← `f91c4e2`

### Added
- Role-based access system: HR and Candidate roles
- Auth pages (login / register) for both roles
- `HRDashboard` page: job list, post-job form, copy apply links
- `CandidateDashboard` page: personal application history with AI scores
- `ProtectedRoute` component for client-side route guarding
- `Navbar` auth state: shows logged-in user name, logout button

### Changed
- Landing page (`/`) adapts based on auth state (redirects to role dashboard)
- WebSocket leaderboard gated by HR JWT (`?token=` query param)

---

## [0.3.0] — 2026-06-20 · Authentication System

> Commit: `08a51cc`

### Added
- `src/worker/lib/auth.ts` — PBKDF2 password hashing (100 k iterations + salt), JWT verify/sign middleware, `requireHR` / `requireCandidate` role guards
- `src/worker/routes/auth.ts` — `POST /register/hr`, `POST /register/candidate`, `POST /login/hr`, `POST /login/candidate`
- `migrations/0002_auth.sql` — `users` table, `jobs.user_id` foreign key
- `AuthPage` React component — unified login/register UI for both roles

---

## [0.2.0] — 2026-06-18 · Live Leaderboard & Apply Page

> Commit range: `c666713` ← `bd6f965`

### Added
- `LeaderboardDO` Durable Object — WebSocket hub, per-job leaderboard, Hibernation API
- Live leaderboard at `/dashboard/:job_id` with WebSocket auto-reconnect
- New-entry highlight animation (`fadeFromIndigo`)
- Candidate apply page at `/apply/:job_id` — PDF upload, score circle result
- Search and fit-category filter on leaderboard (Strong / Potential / No Match)
- Stats row: total candidates, top score, strong fits count
- Tie-breaking: same score → earlier submission ranks higher
- Score badges: green (≥80), yellow (50–79), red (<50)

### Changed
- Improved dark-theme UI with glassmorphism cards, Plus Jakarta Sans font
- Responsive layout for mobile (≤768 px breakpoint)

---

## [0.1.0] — 2026-06-15 · Hackathon MVP

> Commit range: `3b7c427` ← `691febd`

### Added
- Project scaffold: React 19 + Vite + TypeScript + Hono + Cloudflare Workers
- `migrations/0001_init.sql` — `jobs` and `candidates` tables (D1 SQLite)
- `POST /api/jobs` — creates a job, embeds description via `bge-base-en-v1.5`, stores in Vectorize
- `POST /api/candidates` — embeds resume, queries Vectorize for semantic similarity, scores with `llama-3.1-8b-instruct-fast`, stores result in D1
- `GET /api/jobs/:id` — fetches job details for the apply page
- `PostJob` React page — HR job creation form, shareable apply link generator
- Two-stage AI scoring pipeline: vector cosine similarity + LLM 0–100 score with reasoning
- `wrangler.toml` — D1, Vectorize, Workers AI, Durable Objects bindings

> Originally built at the **Cloudflare IRL Bengaluru Hackathon, June 2026**.

---

[Unreleased]: https://github.com/Shashi-17-afk/Cloudflare_Hackathon/compare/main...HEAD
[0.4.0]: https://github.com/Shashi-17-afk/Cloudflare_Hackathon/compare/08a51cc...04b4de3
[0.3.0]: https://github.com/Shashi-17-afk/Cloudflare_Hackathon/compare/c666713...08a51cc
[0.2.0]: https://github.com/Shashi-17-afk/Cloudflare_Hackathon/compare/3b7c427...c666713
[0.1.0]: https://github.com/Shashi-17-afk/Cloudflare_Hackathon/compare/691febd...3b7c427
