# HireSight — AI Resume Screener & Intelligent Recruitment Platform

> Post a job, generate descriptions with AI, screen resumes instantly with edge embeddings & LLM reasoning, schedule interviews, and stream live rankings via real-time WebSockets.

HireSight is an edge-native, full-lifecycle recruitment and applicant tracking system (ATS) built entirely on the Cloudflare developer platform. It eliminates manual first-pass screening by pairing client-side privacy-first PDF parsing with a two-stage AI evaluation pipeline (Cloudflare Vectorize + Workers AI), coordinated in real-time across candidate and recruiter dashboards via Cloudflare Durable Objects.

---

[![CI](https://img.shields.io/github/actions/workflow/status/Shashi-17-afk/Cloudflare_Hackathon/ci.yml?label=CI&style=flat-square)](https://github.com/Shashi-17-afk/Cloudflare_Hackathon/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-hiresight.workers.dev-10b981?style=flat-square)](https://hiresight.shashishanthan2706.workers.dev)

---

## 🌟 Key Features

### 1. 🤖 AI-Powered Job Description Generator & Postings
- **Structured AI Generation**: HR recruiters provide basic role facts (title, department, experience, required skills, employment type, work mode), and Cloudflare Workers AI (`llama-3.1-8b-instruct-fast`) drafts an industry-standard job description in structured JSON format with responsibilities, qualifications, and role summary.
- **Instant Candidate Links**: Every published job generates an immediate, shareable public link (`/apply/:job_id`) for candidate applications.

### 2. 🔒 Privacy-First Client-Side PDF Parsing
- **Zero-Server Raw File Uploads**: Resumes are parsed directly in the candidate's browser using Mozilla `pdfjs-dist`. Only extracted plain text is transmitted to the API, guaranteeing raw PDF binaries never touch server storage or risk data leakage.
- **Scan & Guard Checks**: Enforces 50,000-character payload limits and identifies image-only/scanned documents gracefully.

### 3. 🧠 Two-Stage AI Resume Scoring Engine
- **Stage 1 (Semantic Retrieval)**: 768-dimensional dense vector embeddings generated via `@cf/baai/bge-base-en-v1.5` and matched against job description embeddings stored in **Cloudflare Vectorize** using cosine similarity.
- **Stage 2 (Holistic LLM Evaluation)**: Candidate experience and job requirements are evaluated by `@cf/meta/llama-3.1-8b-instruct-fast`, delivering an accurate 0–100 match score and a concise, evidence-based reasoning summary.
- **On-Demand Re-Scoring**: Recruiters can trigger on-demand re-scoring from candidate details if criteria or job specs adjust.

### 4. ⚡ Real-Time WebSocket Streaming via Durable Objects
- **`LeaderboardDO`**: Stateful per-job Durable Object tracking applicant rankings with deterministic tie-breaking (earlier submissions take precedence on tied scores). Broadcasts live score updates to recruiter dashboard viewers instantly without polling.
- **`CandidateStatusDO`**: Per-candidate Durable Object pushing real-time application status updates (e.g. "Under Review", "Shortlisted", "Interview", "Offer") directly to open candidate browser tabs.
- **Hibernation API**: Leverages Cloudflare Durable Object WebSocket hibernation so idle client connections consume zero billable compute time.

### 5. 🎯 Recruiter ATS Pipeline & Deep Candidate Inspection
- **Kanban & Pipeline Management**: Track candidates across stages: `applied` → `under_review` → `shortlisted` → `interview` → `hired` (or `rejected`).
- **Complete Audit Trail**: Every status transition records the previous state, new state, acting HR user ID, timestamp, and recruiter notes in `application_status_log`.
- **5-Tab Candidate Hub (`CandidateDetail`)**: Recruiter interface featuring Candidate Profile, Documents (extracted text inspection), Interviews, Recruiter-Candidate Direct Communication, and Offer dispatch.

### 6. 📅 Full Interview Scheduling & Feedback Subsystem
- **Multi-Round Presets**: Easily schedule Initial Screening, Technical Rounds 1 & 2, System Design, Cultural Fit, Hiring Manager, or Final Round interviews.
- **Calendar & Management**: Set meeting links (Google Meet, Zoom, etc.), durations (15–90 mins), candidate notes, and time slots.
- **Post-Interview Evaluations**: Recruiters capture post-interview feedback, status transitions (`scheduled`, `completed`, `cancelled`, `rescheduled`), and 1–5 star performance ratings.
- **Automated Candidate Invites**: Candidate receives rich HTML email invitations upon round scheduling.

### 7. 💬 In-App Recruiter ↔ Candidate Messaging
- **Direct Recruiter Outreach**: HR can compose in-app messages linked to specific candidates or job applications.
- **Candidate Inbox & Notification Center**: Real-time unread badge counts, message thread inspection, and automatic transactional email dispatch notifying the candidate of recruiter communications.

### 8. 👤 Candidate Self-Service Portal & Profile Completeness
- **Profile Completeness Engine**: Candidates maintain contact details, headline, bio, experience years, skills, salary expectations, LinkedIn, GitHub, and portfolio links.
- **Completeness Enforcement**: In-platform job applications enforce profile completeness (`is_complete`), ensuring hiring teams receive verified candidate metadata.
- **Application Tracking**: Dedicated dashboard showing live stage badges, scores, recruiter feedback, and scheduled interviews.

### 9. 📩 High-Deliverability Dual Email Engine Failover
- **Native Edge HTTP API**: Zero third-party SDK bloat; uses standard `fetch()` calls to deliver emails in under 15ms.
- **Automatic Provider Failover**: Primary delivery via **Brevo REST API** with automated failover to **Resend API**.
- **Non-Blocking Background Delivery**: Wrapped inside `ctx.waitUntil()` to guarantee email dispatch never delays API response times.
- **Full Notification Suite**: Dispatches welcome emails, candidate application confirmations, recruiter high-match alerts (score ≥ 80), ATS status change alerts, interview invites, and subscription receipts.

### 10. 🔑 Hardened 4-Digit OTP Password Reset Flow
- **4-Digit Numeric Verification**: Auto-advancing OTP UI with verification codes delivered to the user's email.
- **Cloudflare KV State**: 10-minute expiry window, 60-second resend cooldowns, single-use invalidation, and strict 5-attempt brute-force protection.
- **Anti-Enumeration Design**: Obscures whether an account exists to mitigate reconnaissance attacks.

### 11. 💳 Recruiter Subscriptions & Razorpay Payment Integration
- **Workspace Upgrades**: Recruiter Pro and Growth workspace tiers.
- **Cryptographic Security**: Native Web Crypto API HMAC-SHA256 signature verification protects order fulfillment against tampering.
- **Automated Receipts**: Branded payment receipts dispatched automatically on transaction completion.

### 12. 💡 Floating In-App AI Helper Chatbot
- **Context-Aware Assistance**: Powered by `@cf/meta/llama-3.1-8b-instruct-fast` (`/api/help/chat`) with strict product domain knowledge.
- **Role-Aware Guidance**: Assists recruiters with JD creation and scoring criteria, and guides candidates through profile completion and application tracking.

---

## 🛠️ Tech Stack Matrix

| Layer | Technology | Purpose & Edge Capabilities |
|---|---|---|
| **Runtime** | [Cloudflare Workers](https://workers.cloudflare.com/) | Serverless V8 isolates with zero cold starts, global distribution |
| **API Framework** | [Hono v4](https://hono.dev/) | Ultra-lightweight TypeScript routing with typed middleware |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) | Edge relational database with zero round-trip latency |
| **AI Inference** | [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) | `@cf/baai/bge-base-en-v1.5` embeddings & `@cf/meta/llama-3.1-8b-instruct-fast` LLM |
| **Vector Search** | [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) | 768-dim cosine similarity index (`resumes_index`) |
| **Stateful Real-Time** | [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) | `LeaderboardDO` (live rankings) & `CandidateStatusDO` (status push) with Hibernation API |
| **Distributed Cache & KV**| [Cloudflare KV](https://developers.cloudflare.com/kv/) | `RATE_LIMIT` namespace for IP throttling, 4-digit OTP state, and attempt tracking |
| **Frontend UI** | React 19 + TypeScript + Vite 7 | Modern SPA, Lucide React icons, Motion micro-animations, lazy-loaded routes |
| **PDF Extraction** | [pdfjs-dist](https://mozilla.github.io/pdf.js/) | 100% client-side text parsing protecting candidate file privacy |
| **Email Subsystem** | [Brevo REST API](https://www.brevo.com/) + Resend | Resilient dual-engine transactional email with automated failover |
| **Payment Gateway** | [Razorpay Orders API](https://razorpay.com/) | Web Crypto HMAC-SHA256 signature verification & order management |
| **Auth & Security** | PBKDF2-SHA256 + HS256 JWT | 100,000 salt iterations, role-based access control (HR vs Candidate) |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Browser Client (React 19 SPA)                       │
│                                                                             │
│  Public Routes:       / · /jobs · /jobs/:id · /apply/:id · /login · /forgot │
│  Candidate Portal:    /candidate/dashboard · /candidate/profile             │
│  Recruiter Workspace: /hr/dashboard · /hr/jobs · /hr/jobs/new · /dashboard/ │
│                       /hr/candidates · /hr/candidate/:id (5-tab inspection) │
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │                               │
           HTTPS (JSON / Bearer JWT)                    │ WebSocket (WSS ?token=JWT)
                        │                               │
                        ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Cloudflare Worker Edge Router (Hono)                   │
│                                                                             │
│  Middleware:  CORS · RateLimit (KV) · Authenticate (JWT) · RBAC Guards      │
│  Sub-routers: /api/auth · /api/jobs · /api/candidates · /api/applications   │
│               /api/interviews · /api/messages · /api/profile · /api/payments│
│               /api/help · /api/leaderboard · /api/status                    │
└───────┬───────────────┬───────────────────────────────┬──────────────┬──────┘
        │               │                               │              │
        ▼               ▼                               ▼              ▼
┌───────────────┐ ┌───────────────┐           ┌──────────────────┐ ┌──────────┐
│ Cloudflare D1 │ │  Workers AI   │           │ Durable Objects  │ │Cloudflare│
│ (SQLite edge) │ │  bge-base-en  │           │                  │ │    KV    │
│               │ │  llama-3.1-8b │           │  LeaderboardDO   │ │          │
│ • users       │ └───────┬───────┘           │  (Live rankings) │ │• IP rate │
│ • jobs        │         │                   │                  │ │  limits  │
│ • candidates  │         ▼                   │  CandidateStatus │ │• 4-digit │
│ • applications│ ┌───────────────┐           │  (Status push)   │ │  OTP state│
│ • profiles    │ │   Vectorize   │           └──────────────────┘ └──────────┘
│ • interviews  │ │ (768-dim      │                     ▲
│ • messages    │ │  resumes_index│                     │
│ • payments    │ └───────────────┘           ctx.waitUntil()
│ • audit_log   │                                       │
└───────────────┘                                       ▼
                                              ┌──────────────────┐
                                              │ Email Subsystem  │
                                              │ Brevo ➔ Resend   │
                                              └──────────────────┘
```

---

## 💾 Database Schema & Migrations

The database is built on Cloudflare D1 and partitioned across 6 structured SQL migrations located in `/migrations`:

1. **`0001_init.sql`** — Foundation `jobs` and `candidates` tables.
2. **`0002_auth.sql`** — User management table (`users` with role, hashed passwords via PBKDF2) and foreign keys connecting jobs to HR recruiters.
3. **`0003_ats_core.sql`** — Comprehensive ATS engine:
   - `candidate_profiles`: Candidate contact information, external URLs, career preferences, skills, and computed `is_complete` status.
   - `applications`: Application pipeline records, tracking candidate stages (`applied`, `under_review`, `shortlisted`, `interview`, `rejected`, `hired`), source (`browse` vs `link`), and acting recruiter.
   - `application_status_log`: Append-only audit log tracking every status transition with recruiter notes.
4. **`0004_payments.sql`** — Recruiter Pro billing and subscription records (`payments` table with Razorpay order, payment ID, currency, and verified signatures).
5. **`0005_messages.sql`** — In-app communication system (`messages` table linking recruiters and candidates with unread tracking).
6. **`0006_interviews.sql`** — Interview scheduling system (`interviews` table with round types, meeting links, scheduled timestamps, duration, status, feedback, and 1–5 star ratings).

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or later)
- Cloudflare account with Wrangler CLI configured

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Shashi-17-afk/Cloudflare_Hackathon.git hiresight
cd hiresight
npm install
```

### 2. Configure Cloudflare Wrangler
```bash
npx wrangler login
```

### 3. Setup Local Secrets
Copy `.env.example` to `.dev.vars` (used by Wrangler during local dev):
```bash
cp .env.example .dev.vars
```
Update `.dev.vars` with your credentials:
```env
JWT_SECRET=dev_local_secret_at_least_32_characters_long
BREVO_API_KEY=xkeysib-...
RESEND_API_KEY=re_...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

### 4. Execute D1 Database Migrations
Run all 6 database migrations against local SQLite:
```bash
npm run db:migrate:local
```
*(For production Cloudflare D1 deployment, use `npm run db:migrate:remote`)*

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). The frontend React SPA and Cloudflare Workers API will start with hot module reloading.

---

## 📡 API Reference

### 🔐 Authentication & Password Recovery

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register/hr` | Public | Register HR recruiter account & dispatch welcome email |
| `POST` | `/api/auth/register/candidate` | Public | Register candidate account & dispatch welcome email |
| `POST` | `/api/auth/login/hr` | Public | Authenticate recruiter & issue 24-hr JWT |
| `POST` | `/api/auth/login/candidate` | Public | Authenticate candidate & issue 24-hr JWT |
| `POST` | `/api/auth/forgot-password` | Public | Generate 4-digit OTP code & dispatch email (IP & email rate limited) |
| `POST` | `/api/auth/verify-otp` | Public | Verify 4-digit OTP code with attempt counter |
| `POST` | `/api/auth/reset-password` | Public | Finalize password reset using verified OTP |

### 💼 Jobs & AI Description Generation

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/jobs` | HR JWT | Create job opening & store description embedding in Vectorize |
| `POST` | `/api/jobs/generate-description` | HR JWT | Generate structured JD using Workers AI (`llama-3.1-8b-instruct-fast`) |
| `GET` | `/api/jobs` | Public | List active job openings with applicant counts |
| `GET` | `/api/jobs/:id` | Public | Retrieve job description and metadata |
| `DELETE` | `/api/jobs/:id` | HR JWT | Remove a job posting and associated listings |

### 📝 Candidates & Screening Engine

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/candidates` | Public / Bearer | Submit parsed resume ➔ Vectorize similarity + Workers AI LLM scoring |
| `GET` | `/api/candidates/my-applications` | Candidate JWT | List all submitted applications and statuses for current user |
| `GET` | `/api/profile` | Candidate JWT | Retrieve candidate ATS profile and completeness flag |
| `PUT` | `/api/profile` | Candidate JWT | Update profile details (auto-calculates completeness percentage) |

### 📊 ATS Pipeline & Application Review

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/applications` | HR JWT | Filter candidates by `job_id`, `status`, or search query |
| `GET` | `/api/applications/all` | HR JWT | Comprehensive candidate directory across all recruiter openings |
| `GET` | `/api/applications/hired` | HR JWT | Dedicated view of accepted offers and hired candidates |
| `GET` | `/api/applications/:submission_id` | HR JWT | Deep candidate inspection (resume text, AI scores, audit log, interviews) |
| `POST` | `/api/applications/:submission_id/rescore` | HR JWT | Re-run Workers AI scoring for candidate resume against updated criteria |
| `PATCH` | `/api/applications/:id/status` | HR JWT | Move candidate stage; updates audit log & notifies via DO + email |

### 📅 Interview Scheduling System

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/interviews` | HR JWT | Schedule interview round, set meeting link, and dispatch candidate email |
| `GET` | `/api/interviews` | HR JWT | List upcoming/past interviews across recruiter jobs |
| `GET` | `/api/interviews/application/:id`| HR JWT | List all scheduled rounds for a specific candidate application |
| `GET` | `/api/interviews/my` | Candidate JWT | Candidate retrieves their scheduled interview calendar |
| `PATCH` | `/api/interviews/:id` | HR JWT | Update interview status, provide evaluation feedback, or add 1–5 star rating |
| `DELETE` | `/api/interviews/:id` | HR JWT | Cancel and remove an interview round |

### 💬 Recruiter ↔ Candidate Messaging

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/messages` | HR JWT | Recruiter sends in-app message & triggers candidate email notification |
| `GET` | `/api/messages/inbox` | Candidate JWT | Candidate retrieves inbound recruiter messages |
| `GET` | `/api/messages/sent` | HR JWT | Recruiter views history of sent candidate messages |
| `GET` | `/api/messages/unread-count` | Candidate JWT | Returns unread message count for notification badges |
| `PATCH` | `/api/messages/:id/read` | Candidate JWT | Mark message as read |
| `DELETE` | `/api/messages/:id` | Authenticated | Delete message from user thread |

### 🤖 In-App AI Helper & Real-Time WebSockets

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/help/chat` | Authenticated | Interactive in-app helper powered by Workers AI |
| `GET` | `/api/leaderboard/:job_id` | HR JWT | REST snapshot of candidate leaderboard |
| `WS` | `/api/leaderboard/:job_id/ws` | HR (`?token=`) | WebSocket stream from `LeaderboardDO` for live candidate rank changes |
| `WS` | `/api/status/ws` | Candidate (`?token=`) | WebSocket stream from `CandidateStatusDO` for real-time stage updates |

### 💳 Recruiter Billing & Subscriptions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/payments/create-order` | HR JWT | Initialize Razorpay subscription order |
| `POST` | `/api/payments/verify` | HR JWT | Verify Web Crypto HMAC-SHA256 signature and activate plan |
| `GET` | `/api/payments/status` | HR JWT | Fetch current recruiter workspace plan and active tier |

---

## 🧪 Live Demo & Reviewer Credentials

The platform is deployed globally on Cloudflare Workers and available for evaluation:

**Live URL:** [https://hiresight.shashishanthan2706.workers.dev](https://hiresight.shashishanthan2706.workers.dev)

### Pre-Seeded Verification Accounts

| Portal | Role | Email | Password |
|---|---|---|---|
| **Recruiter Workspace** | Recruiter (HR) | `demo-hr@hiresight.dev` | `DemoHR2026!` |
| **Candidate Portal** | Candidate | `demo@hiresight.dev` | `DemoCandidate2026!` |

---

## 🔍 Recommended Reviewer Walkthrough

### 1. Test AI Job Description Generation & Posting
1. Log in as Recruiter (`demo-hr@hiresight.dev`).
2. Navigate to **Post a Job** (`/hr/jobs/new`).
3. Enter a role title (e.g. *"Cloud Native Platform Engineer"*), select a department, and specify key skills.
4. Click **Generate with AI** — watch Cloudflare Workers AI draft an organized job description in seconds.
5. Click **Use This Description & Publish** — the opening is saved to D1 and its description embedding stored in Vectorize.
6. Copy the generated candidate application link.

### 2. Test Resume Screening & Real-Time Leaderboard
1. Open the copied application link in an Incognito / private window.
2. Upload any standard technical resume (PDF). Notice the text is extracted client-side via Mozilla PDF.js.
3. Submit the application — Workers AI computes the match score and concise rationale.
4. Return to your Recruiter window at `/dashboard/:job_id` — see the candidate instantly appear on the live WebSocket leaderboard without refreshing!

### 3. Test ATS Review, Interview Scheduling & In-App Messaging
1. In the Recruiter workspace, click on the candidate to open the **Candidate Detail Hub** (`/hr/candidate/:id`).
2. Explore the tabs:
   - **Profile**: Review verified contact details and candidate links.
   - **Documents**: Inspect the full extracted resume text.
   - **Interviews**: Click **Schedule Interview**, select *"Technical Round 1"*, pick a time, add a meeting link, and submit.
   - **Communication**: Compose and send a direct message to the candidate.
   - **Offer**: Move candidate status to Shortlisted or Hired.

### 4. Test Candidate Portal & Real-Time Status Push
1. Log in to the Candidate Portal (`demo@hiresight.dev`).
2. Check your dashboard:
   - Watch the live application stage badge update in real time via Durable Objects!
   - Review scheduled interviews with meeting launch links.
   - Check the message inbox for recruiter communications.

### 5. Test 4-Digit OTP Password Reset Flow
1. Navigate to `/forgot-password`.
2. Input an account email to request a 4-digit OTP.
3. Enter the 4-digit code in the numeric input boxes to verify and set a new password.

---

## 🚢 Production Deployment

```bash
# 1. Type-check application, node, and worker code
npm run build

# 2. Deploy Worker and client bundle to Cloudflare Edge
npm run deploy

# 3. Configure production secrets via Wrangler CLI
wrangler secret put JWT_SECRET
wrangler secret put BREVO_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put RAZORPAY_KEY_ID
wrangler secret put RAZORPAY_KEY_SECRET

# 4. Generate Cloudflare TypeScript bindings
npm run cf-typegen
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 Shashi Shanthan.

*Built for modern hiring teams on the Cloudflare Developer Platform.*
