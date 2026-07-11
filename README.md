# HireSight — AI Resume Screener

> Post a job, share a link. AI scores every resume instantly and ranks candidates on a live leaderboard.

Built for HR teams and candidates who want signal instead of noise in the first-pass screening round.

---

![HireSight hero screenshot](docs/screenshots/hero.png)

[![CI](https://img.shields.io/github/actions/workflow/status/Shashi-17-afk/Cloudflare_Hackathon/ci.yml?label=CI&style=flat-square)](https://github.com/Shashi-17-afk/Cloudflare_Hackathon/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-hiring--screener.workers.dev-10b981?style=flat-square)](https://hiring-screener.shashishanthan2706.workers.dev)

---

## Features

- **Post a job in 30 seconds** — fill in title and description, get a shareable apply link instantly
- **Parse resumes in the browser** — candidates upload a PDF; text is extracted client-side via PDF.js (the file never leaves their device)
- **Score resumes with a two-stage AI pipeline** — semantic similarity via Vectorize embeddings + LLM scoring (0–100) with a 2-line reasoning
- **Watch the leaderboard update live** — WebSocket-powered dashboard; new candidates appear and re-rank in real time without page refresh
- **Filter and search candidates** — by name or fit category (Strong ≥ 80 / Potential 50–79 / No Match < 50)
- **Role-based portals** — separate authenticated dashboards for HR recruiters and candidates
- **Track your own applications** — candidates log in to see every role they applied for and their AI feedback

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com/) | Serverless, globally distributed, zero cold start |
| API framework | [Hono](https://hono.dev/) | Built for edge runtimes; typed middleware; tiny bundle |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) | Relational, co-located with Workers, no round-trip latency |
| AI inference | [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) | `bge-base-en-v1.5` embeddings + `llama-3.1-8b-instruct-fast` scoring, no external API keys |
| Vector search | [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) | 768-dim cosine similarity between resume and JD embeddings |
| Real-time state | [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) | Stateful WebSocket hub, one instance per job, Hibernation API |
| Frontend | React 19 + TypeScript + Vite | Component-based UI, lazy-loaded routes, HMR in dev |
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

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret used to sign and verify HS256 JWTs. Set via `wrangler secret put JWT_SECRET` in production. Must be at least 32 characters. |

The following are Cloudflare binding names declared in `wrangler.toml`, not environment variables:

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 Database | Jobs, candidates, users tables |
| `VECTORIZE` | Vectorize Index | Resume and JD embeddings (768-dim) |
| `AI` | Workers AI | Embedding model + LLM scoring |
| `LEADERBOARD` | Durable Object | Per-job WebSocket leaderboard hub |

---

## Architecture

HireSight runs entirely on Cloudflare's developer platform. The React SPA is served as static assets from the CDN. All API calls and WebSocket connections route to a single Cloudflare Worker (Hono), which orchestrates D1, Workers AI, Vectorize, and Durable Objects.

See [docs/architecture.md](docs/architecture.md) for the entity-relationship diagram, auth flow, and three non-obvious technical decisions that shaped the implementation.

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
| `POST` | `/api/candidates` | Public | Submit resume → AI score |
| `GET` | `/api/candidates/my-applications` | Candidate JWT | View own application history |
| `GET` | `/api/leaderboard/:job_id` | HR JWT | REST snapshot of leaderboard |
| `WS` | `/api/leaderboard/:job_id/ws` | HR JWT (`?token=`) | Live leaderboard WebSocket |

---

## Demo

**Live app:** [https://hiring-screener.shashishanthan2706.workers.dev](https://hiring-screener.shashishanthan2706.workers.dev)

You can register a new account on the live app.  
For a quick tour without registration, browse the public job board at `/jobs` or open any `/apply/:job_id` link.

> Demo credentials are not pre-seeded — register a free account to test the full HR or candidate flow.

---

## Testing

Automated tests are on the roadmap. The recommended approach for this stack:

- **Worker routes:** [Vitest](https://vitest.dev/) + Hono's `app.request()` test helper
- **React components:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
- **End-to-end:** [Playwright](https://playwright.dev/)

PRs that add test coverage are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup.

---

## Roadmap

- [ ] Email notification when a new top candidate is scored
- [ ] HR filter: show only candidates above a custom score threshold
- [ ] Multi-page resume support (currently merges all pages into one string)
- [ ] R2 storage for raw PDFs (currently only extracted text is stored)
- [ ] Rate limiting on `POST /api/candidates` (prevent spam submissions)
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
