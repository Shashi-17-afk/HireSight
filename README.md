# HireSight — AI Resume Screener

> Post a job, share a link. AI scores every resume instantly and ranks candidates on a live leaderboard.

Built for HR teams and candidates who want signal instead of noise in the first-pass screening round.

---

[![CI](https://img.shields.io/github/actions/workflow/status/Shashi-17-afk/Cloudflare_Hackathon/ci.yml?label=CI&style=flat-square)](https://github.com/Shashi-17-afk/Cloudflare_Hackathon/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-hiresight.workers.dev-10b981?style=flat-square)](https://hiresight.shashishanthan2706.workers.dev)

---

## Features

- **Post a job in 30 seconds** — fill in title and description, get a shareable apply link instantly
- **Parse resumes in the browser** — candidates upload a PDF; text is extracted client-side via PDF.js (the file never leaves their device)
- **Score resumes with a two-stage AI pipeline** — semantic similarity via Vectorize embeddings + LLM scoring (0–100) with a 2-line reasoning
- **Watch the leaderboard update live** — WebSocket-powered dashboard (`LeaderboardDO`); new candidates appear and re-rank in real time without page refresh
- **IP-based rate limiting** — Cloudflare KV (`RATE_LIMIT`) restricts resume submissions (5 per IP / 60s) to prevent spam
- **Role-based portals & authentication** — separate authenticated dashboards for HR recruiters and candidates with JWT session handling
- **Candidate profiles & ATS application tracking** — candidates manage their profile details and track past application statuses in real time via WebSocket (`CandidateStatusDO`)
- **HR candidate management pipeline** — recruiters inspect submission details, full extracted resume text, and update candidate ATS statuses (Reviewed, Interviewing, Offer Extended, Hired, Rejected)
- **Filter and search candidates** — filter candidates by title, name, or fit category (Strong ≥ 80 / Potential 50–79 / No Match < 50)

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com/) | Serverless, globally distributed, zero cold start |
| API framework | [Hono](https://hono.dev/) | Built for edge runtimes; typed middleware; tiny bundle |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) | Relational, co-located with Workers, no round-trip latency |
| AI inference | [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) | `bge-base-en-v1.5` embeddings + `llama-3.1-8b-instruct-fast` scoring, no external API keys |
| Vector search | [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) | 768-dim cosine similarity between resume and JD embeddings |
| Real-time state | [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) | Stateful WebSocket hubs: `LeaderboardDO` (per-job leaderboard) & `CandidateStatusDO` (candidate status stream) |
| Rate limiting | [Cloudflare KV](https://developers.cloudflare.com/kv/) | High-speed IP-based rate limiting (`RATE_LIMIT` namespace) |
| Frontend | React 19 + TypeScript + Vite + Motion | Component-based UI, Motion micro-animations, lazy-loaded routes |
| PDF parsing | [pdfjs-dist](https://mozilla.github.io/pdf.js/) | Client-side text extraction — no server upload of file bytes |
| Auth | PBKDF2 password hashing + HS256 JWT | Standards-compliant, runs natively in the Workers crypto API |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Shashi-17-afk/Cloudflare_Hackathon.git hiresight
cd hiresight
npm install
```

### 2. Authenticate Wrangler

```bash
npx wrangler login
```

### 3. Set environment variables

```bash
cp .env.example .dev.vars
# Edit .dev.vars — set JWT_SECRET to a strong random value
# Generate one: openssl rand -hex 32
```

### 4. Run database migrations

```bash
# Local D1 (for development)
npm run db:migrate:local

# Production D1 (when ready to deploy)
npm run db:migrate:remote
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).  
The React app and the Cloudflare Worker both run locally — no remote calls needed for the core flow.

> **Note:** Workers AI and Vectorize require a Cloudflare account even in local development. If they are unavailable, resume scoring falls back to a semantic-only score.

---

## Environment Variables & Bindings

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret used to sign and verify HS256 JWTs. Set via `wrangler secret put JWT_SECRET` in production. Must be at least 32 characters. |

The following are Cloudflare binding names declared in `wrangler.toml`:

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 Database | Jobs, candidates, users, candidate profiles, and ATS applications tables |
| `VECTORIZE` | Vectorize Index | Resume and JD embeddings (768-dim) |
| `AI` | Workers AI | Embedding model + LLM scoring |
| `LEADERBOARD` | Durable Object | Per-job WebSocket leaderboard hub |
| `CANDIDATE_STATUS` | Durable Object | Per-candidate WebSocket real-time status notification hub |
| `RATE_LIMIT` | KV Namespace | High-speed IP-based rate limiting on candidate submissions |

---

## Architecture & Documentation

HireSight runs entirely on Cloudflare's developer platform. The React SPA is served as static assets from the CDN. All API calls and WebSocket connections route to a single Cloudflare Worker (Hono), which orchestrates D1, Workers AI, Vectorize, KV, and Durable Objects.

See [docs/architecture.md](docs/architecture.md) for the entity-relationship diagram, auth flows, and core technical decisions that shaped the implementation.


---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | Public | Liveness check |
| `POST` | `/api/auth/register/hr` | Public | Register an HR account |
| `POST` | `/api/auth/register/candidate` | Public | Register a candidate account |
| `POST` | `/api/auth/login/hr` | Public | HR login → JWT |
| `POST` | `/api/auth/login/candidate` | Public | Candidate login → JWT |
| `POST` | `/api/jobs` | HR JWT | Create job + embed JD |
| `GET` | `/api/jobs` | Public | List all open jobs (with applicant count) |
| `GET` | `/api/jobs/:id` | Public | Get single job details |
| `POST` | `/api/candidates` | Public | Submit resume → rate-limit check + AI score |
| `GET` | `/api/candidates/my-applications` | Candidate JWT | View candidate application history |
| `GET` | `/api/profile` | Candidate JWT | Fetch candidate profile |
| `PUT` | `/api/profile` | Candidate JWT | Update candidate profile |
| `GET` | `/api/applications` | HR JWT | List candidate applications (ATS pipeline) |
| `GET` | `/api/applications/:id` | HR JWT | Get single candidate application details |
| `PATCH` | `/api/applications/:id/status` | HR JWT | Update candidate application status |
| `GET` | `/api/leaderboard/:job_id` | HR JWT | REST snapshot of leaderboard |
| `WS` | `/api/leaderboard/:job_id/ws` | HR JWT (`?token=`) | Live leaderboard WebSocket stream |
| `WS` | `/api/status/ws` | Candidate JWT (`?token=`) | Live candidate status WebSocket stream |

---

## Demo

**Live app:** [https://hiresight.shashishanthan2706.workers.dev](https://hiresight.shashishanthan2706.workers.dev)

Use the pre-seeded demo accounts below to explore both portals immediately — no registration required.

| Role | Email | Password |
|------|-------|----------|
| **HR / Recruiter** | `demo-hr@hiresight.dev` | `DemoHR2026!` |
| **Candidate** | `demo@hiresight.dev` | `DemoCandidate2026!` |

**Suggested reviewer flow:**
1. Log in as HR → post a job → copy the apply link
2. Open the apply link in a private window → upload a PDF resume → submit
3. Switch back to HR → watch the candidate appear on the live leaderboard in real time
4. Update candidate status in HR portal → see status change pushed via WebSocket to candidate dashboard

> **Note:** These demo accounts have standard write access (not read-only). See [docs/architecture.md](docs/architecture.md) Known Limitations for context.

---

## Testing

Automated tests are on the roadmap. The recommended approach for this stack:

- **Worker routes:** [Vitest](https://vitest.dev/) + Hono's `app.request()` test helper
- **React components:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
- **End-to-end:** [Playwright](https://playwright.dev/)

PRs that add test coverage are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup.

---

## Roadmap

- [x] Rate limiting on `POST /api/candidates` (prevent spam submissions)
- [x] Candidate profile management & ATS candidate status pipeline
- [ ] Email notification when a new top candidate is scored
- [ ] HR filter: show only candidates above a custom score threshold
- [ ] Multi-page resume support (currently merges all pages into one string)
- [ ] R2 storage for raw PDFs (currently only extracted text is stored)
- [ ] Lock CORS origin to production domain
- [ ] Vitest unit tests for Worker routes and React components
- [ ] GitHub Actions CI pipeline

---

## Deployment

```bash
# Build and deploy to Cloudflare Workers
npm run deploy

# Set production secrets (run once per environment)
wrangler secret put JWT_SECRET

# Regenerate TypeScript types after changing wrangler.toml
npm run cf-typegen
```

---

## License

[MIT](LICENSE) © 2026 Shashi Shanthan

---

*Originally built at the **Cloudflare IRL Bengaluru Hackathon, June 2026**.*
