# HireSight — AI Resume Screener & Recruitment Platform

> Post a job, share a link. AI scores every resume instantly and ranks candidates on a live leaderboard.

HireSight is an edge-native, AI-powered recruitment platform built for modern HR teams and candidates. It replaces manual first-pass resume screening with semantic vector search, LLM-based fit scoring, real-time WebSocket leaderboards, and transactional email notifications.

---

[![CI](https://img.shields.io/github/actions/workflow/status/Shashi-17-afk/Cloudflare_Hackathon/ci.yml?label=CI&style=flat-square)](https://github.com/Shashi-17-afk/Cloudflare_Hackathon/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-hiresight.workers.dev-10b981?style=flat-square)](https://hiresight.shashishanthan2706.workers.dev)

---

## Key Features

- ⚡ **Instant Job Postings** — Post a job opening in seconds; receive a unique, shareable candidate application link instantly.
- 🔒 **Zero-Server Browser PDF Parsing** — Candidates upload PDF resumes; text extraction occurs entirely client-side via PDF.js without raw file bytes leaving their device.
- 🧠 **Two-Stage AI Scoring Pipeline** — 768-dimensional semantic embeddings via `bge-base-en-v1.5` on Cloudflare Vectorize paired with LLM scoring (`llama-3.1-8b-instruct-fast`) generating a 0–100 score and concise reasoning.
- 📊 **Real-Time WebSocket Leaderboards** — Stateful `LeaderboardDO` Durable Objects stream live applicant scores and re-rankings to recruiter dashboards without page refreshes.
- 🔑 **Secure 4-Digit Email OTP Password Reset** — Dedicated forgot/reset password system with 4-digit numeric verification codes dispatched via transactional email, 60s cooldowns, and 5-attempt brute-force protection.
- 📩 **Transactional Email Engine** — Automated welcome emails, application submission receipts, status updates, applicant alerts, and subscription receipts powered by Brevo & Resend APIs.
- 💳 **Recruiter Workspace & Razorpay Payments** — Subscription plan upgrades for HR teams with Razorpay order creation, Web Crypto HMAC-SHA256 signature verification, and automated payment receipts.
- 👤 **Dual Role Portals & Application Tracking** — Separate authenticated workflows for HR Recruiters (pipeline management, status updates) and Candidates (profile management, real-time status updates via `CandidateStatusDO`).
- 🛡️ **KV Rate-Limiting & Security** — Cloudflare KV (`RATE_LIMIT`) enforces IP-based candidate submission caps (5 per IP / 60s) and anti-enumeration OTP rate limits.

---

## Tech Stack

| Layer | Technology | Purpose & Advantages |
|-------|-----------|----------------------|
| **Runtime** | [Cloudflare Workers](https://workers.cloudflare.com/) | Serverless edge execution, zero cold starts, global distribution |
| **API Framework** | [Hono](https://hono.dev/) | Lightweight, ultra-fast routing with typed middleware |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) | Co-located relational database with zero round-trip latency |
| **AI Inference** | [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) | Native `bge-base-en-v1.5` embeddings & `llama-3.1-8b-instruct-fast` LLM scoring |
| **Vector Search** | [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) | 768-dim cosine similarity index between job descriptions & candidate resumes |
| **Real-Time State** | [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) | `LeaderboardDO` (live per-job rankings) & `CandidateStatusDO` (candidate status stream) |
| **Rate Limiting & OTP** | [Cloudflare KV](https://developers.cloudflare.com/kv/) | `RATE_LIMIT` namespace for IP throttling, 4-digit OTP state & attempt counters |
| **Frontend** | React 19 + TypeScript + Vite | Component-driven SPA, Motion micro-animations, lazy-loaded routes |
| **PDF Extraction** | [pdfjs-dist](https://mozilla.github.io/pdf.js/) | Client-side resume text parsing (privacy-preserving) |
| **Email Service** | [Brevo REST API](https://www.brevo.com/) / Resend | High-deliverability transactional emails (welcome, status, OTP, receipts) |
| **Payment Gateway** | [Razorpay API](https://razorpay.com/) | Order creation & Web Crypto HMAC-SHA256 signature verification |
| **Authentication** | PBKDF2 + HS256 JWT | Standards-compliant password hashing and session tokens |

---

## Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Shashi-17-afk/Cloudflare_Hackathon.git hiresight
cd hiresight
npm install
```

### 2. Authenticate Wrangler CLI

```bash
npx wrangler login
```

### 3. Environment Setup

```bash
cp .env.example .dev.vars
# Edit .dev.vars and set required secrets:
# JWT_SECRET (generate using: openssl rand -hex 32)
# BREVO_API_KEY / RESEND_API_KEY (for transactional email dispatch)
# RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (for recruiter subscriptions)
```

### 4. Run D1 Database Migrations

```bash
# Local D1 SQLite (for development)
npm run db:migrate:local

# Production Cloudflare D1 (for deployment)
npm run db:migrate:remote
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Both the Vite React frontend and the Cloudflare Worker API run locally with hot module replacement.

---

## Environment Variables & Bindings

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret key for signing HS256 JWTs. Set via `wrangler secret put JWT_SECRET` in production (min 32 chars). |
| `BREVO_API_KEY` | Optional | Brevo API key for transactional emails (OTP, status updates, welcome, payment receipts). |
| `RESEND_API_KEY` | Optional | Fallback email provider API key. |
| `RAZORPAY_KEY_ID` | Optional | Razorpay Key ID for Recruiter Pro workspace subscriptions. |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay Key Secret used to verify payment Web Crypto HMAC signatures. |

### Cloudflare Worker Bindings (`wrangler.toml`)

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 Database | Storage for users, jobs, candidates, profiles, applications, and payments |
| `VECTORIZE` | Vectorize Index | 768-dim vector embeddings (`resumes_index`) |
| `AI` | Workers AI | `bge-base-en-v1.5` & `llama-3.1-8b-instruct-fast` inference |
| `LEADERBOARD` | Durable Object | Per-job WebSocket real-time leaderboard hub |
| `CANDIDATE_STATUS` | Durable Object | Per-candidate WebSocket real-time application status hub |
| `RATE_LIMIT` | KV Namespace | High-speed IP rate limiting & 4-digit OTP state management |

---

## API Reference

### Authentication & Password Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register/hr` | Public | Register HR Recruiter account & send welcome email |
| `POST` | `/api/auth/register/candidate` | Public | Register Candidate account & send welcome email |
| `POST` | `/api/auth/login/hr` | Public | Recruiter login → Returns JWT |
| `POST` | `/api/auth/login/candidate` | Public | Candidate login → Returns JWT |
| `POST` | `/api/auth/forgot-password` | Public | Generate & email 4-digit OTP code (IP & email rate limited) |
| `POST` | `/api/auth/verify-otp` | Public | Verify 4-digit OTP code (tracked max 5 failed attempts) |
| `POST` | `/api/auth/reset-password` | Public | Update password using 4-digit OTP code |

### Jobs & Candidates API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/jobs` | HR JWT | Create job opening & store JD vector embedding |
| `GET` | `/api/jobs` | Public | List open job postings with candidate counts |
| `GET` | `/api/jobs/:id` | Public | Get details for a specific job posting |
| `POST` | `/api/candidates` | Public | Submit parsed resume → Vectorize + Workers AI scoring |
| `GET` | `/api/candidates/my-applications` | Candidate JWT | List candidate's submitted applications |
| `GET` | `/api/profile` | Candidate JWT | Fetch logged-in candidate profile |
| `PUT` | `/api/profile` | Candidate JWT | Update candidate profile details |

### ATS Pipeline & Leaderboards

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/applications` | HR JWT | List candidate applications with search/fit filters |
| `GET` | `/api/applications/:id` | HR JWT | Inspect candidate application & full resume text |
| `PATCH` | `/api/applications/:id/status` | HR JWT | Update ATS candidate status (Shortlisted, Interview, Hired, etc.) |
| `GET` | `/api/leaderboard/:job_id` | HR JWT | REST snapshot of job candidate leaderboard |
| `WS` | `/api/leaderboard/:job_id/ws` | HR JWT (`?token=`) | WebSocket stream for live leaderboard updates |
| `WS` | `/api/status/ws` | Candidate JWT (`?token=`) | WebSocket stream for real-time candidate status alerts |

### Recruiter Subscriptions & Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/payments/create-order` | HR JWT | Create Razorpay order for Recruiter workspace upgrade |
| `POST` | `/api/payments/verify-signature` | HR JWT | Verify Razorpay HMAC-SHA256 signature & trigger receipt |
| `POST` | `/api/payments/webhook` | Webhook | Handle asynchronous Razorpay payment events |

---

## Live Demo & Reviewer Credentials

**Live Application:** [https://hiresight.shashishanthan2706.workers.dev](https://hiresight.shashishanthan2706.workers.dev)

Explore the application immediately using the pre-seeded demo accounts:

| Portal | Role | Email | Password |
|--------|------|-------|----------|
| Recruiter Workspace | **HR / Recruiter** | `demo-hr@hiresight.dev` | `DemoHR2026!` |
| Candidate Portal | **Candidate** | `demo@hiresight.dev` | `DemoCandidate2026!` |

### Suggested Verification Flow

1. **Test 4-Digit Password Reset**:
   - Navigate to `/forgot-password` (or click "Forgot password?" on any login form).
   - Enter your email address to receive a 4-digit OTP email.
   - Enter the 4-digit code in the auto-advancing OTP boxes, set a new password, and log in.
2. **Test HR Job Creation & Candidate AI Scoring**:
   - Log in as Recruiter → Create a new job posting → Copy the candidate apply link.
   - Open the apply link in an Incognito window → Upload a PDF resume → Submit application.
   - Watch the candidate appear on the HR Live Leaderboard in real time via Durable Objects!
3. **Test Real-Time Status Notifications**:
   - Change candidate status in HR dashboard → Watch candidate dashboard update instantly via WebSocket & receive status update email.

---

## Deployment & Maintenance

```bash
# Build production bundle and deploy to Cloudflare Workers
npm run deploy

# Set production secrets
wrangler secret put JWT_SECRET
wrangler secret put BREVO_API_KEY
wrangler secret put RAZORPAY_KEY_ID
wrangler secret put RAZORPAY_KEY_SECRET

# Regenerate Cloudflare Worker TypeScript bindings
npm run cf-typegen
```

---

## Architecture Documentation

For complete architectural diagrams, database schemas, WebSocket event formats, and design decisions, see [docs/architecture.md](docs/architecture.md).

---

## License

[MIT](LICENSE) © 2026 Shashi Shanthan

---

*Originally built at the **Cloudflare IRL Bengaluru Hackathon, June 2026**.*
