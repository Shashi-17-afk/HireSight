# HireSight — Complete Interview Preparation Guide

> You are the author of every line in this project. This document teaches you the entire codebase from zero to interview-ready.

---

## Table of Contents

1. [Part 1 — High Level Overview](#part-1--high-level-overview)
2. [Part 2 — Folder Structure](#part-2--folder-structure)
3. [Part 3 — File-by-File Deep Dive](#part-3--file-by-file-deep-dive)
4. [Part 4 — React Concepts](#part-4--react-concepts)
5. [Part 5 — Backend Architecture](#part-5--backend-architecture)
6. [Part 6 — Database](#part-6--database)
7. [Part 7 — APIs](#part-7--apis)
8. [Part 8 — Authentication & Security](#part-8--authentication--security)
9. [Part 9 — Styling](#part-9--styling)
10. [Part 10 — Performance](#part-10--performance)
11. [Part 11 — Design Decisions](#part-11--design-decisions)
12. [Part 12 — Libraries](#part-12--libraries)
13. [Part 13 — Configuration](#part-13--configuration)
14. [Part 14 — Git & Deployment](#part-14--git--deployment)
15. [Part 15 — Interview Questions](#part-15--interview-questions)
16. [Part 16 — Mock Interview Guide](#part-16--mock-interview-guide)
17. [Part 17 — Weakness Detection Checklist](#part-17--weakness-detection-checklist)
18. [Part 18 — Final Interview Readiness Report](#part-18--final-interview-readiness-report)

---

# Part 1 — High Level Overview

## What is HireSight?

HireSight is an **AI-powered resume screening web application**. In plain English: a company posts a job, shares a link with candidates, candidates upload their resume as a PDF, and within seconds the AI gives each candidate a score (0–100) and tells them how well their resume matches the job. The recruiter watches all candidates appear on a live leaderboard — ranked in real time — without refreshing the page.

## What Problem Does It Solve?

Traditional hiring is slow. A recruiter receives hundreds of resumes and must manually read each one. HireSight automates the first-pass screening:

- **For HR/Recruiters:** Post a job in 30 seconds, get an AI-ranked leaderboard of candidates automatically.
- **For Candidates:** Upload a resume, instantly know if you're a good fit before waiting weeks for a response.

## Target Users

| User | Role |
|------|------|
| HR Manager / Recruiter | Posts jobs, monitors the live leaderboard |
| Job Candidate | Receives the apply link, uploads their PDF resume |

## Main Features

1. **Job Posting** — HR fills in a title and description. The app stores it and generates a shareable apply link.
2. **PDF Resume Parsing** — Candidate uploads a PDF. The app extracts text directly in the browser (no server upload of the raw file).
3. **AI Resume Scoring** — Two-stage AI: vector similarity + LLM scoring from 0–100 with a 2-line reasoning.
4. **Live Leaderboard** — WebSocket-powered. New candidates appear instantly on the recruiter's dashboard, sorted by score.
5. **Tie-breaking** — Candidates with the same score are ranked by submission time (earlier = higher).
6. **Search & Filter** — Recruiter can search by name, filter by Strong Fit (≥80), Potential (50–79), or No Match (<50).

## Overall Architecture

```
Browser (React SPA)
       │
       │  HTTPS / WSS
       ▼
Cloudflare Workers (Hono HTTP API)
       │
       ├── D1 (SQLite) ──── jobs + candidates tables
       ├── Workers AI ────── bge-base-en-v1.5 (embeddings) + llama-3.1-8b (LLM scoring)
       ├── Vectorize ──────── 768-dim embedding index (semantic search)
       └── Durable Object ── LeaderboardDO (WebSocket hub + persistent state)
```

- The **React frontend** is a Single Page Application (SPA). It is served as static files from Cloudflare's CDN.
- The **Hono backend** runs on Cloudflare Workers — serverless, globally distributed, no traditional server.
- All data lives inside Cloudflare infrastructure: D1 (relational SQL), Vectorize (vector DB), Durable Objects (stateful coordination).

## Complete User Flow

```
1. HR opens the app at "/"
2. Fills in Job Title + Description → clicks "Create Job"
3. App calls POST /api/jobs
   → Worker embeds the JD using Workers AI (bge-base-en-v1.5)
   → Stores job in D1 (SQLite)
   → Stores embedding in Vectorize
   → Returns job_id
4. App shows a shareable apply link: /apply/{job_id}
5. HR opens /dashboard/{job_id} — WebSocket connects to LeaderboardDO
6. HR shares the apply link with candidates
---
7. Candidate opens /apply/{job_id}
8. App fetches job title from GET /api/jobs/:id
9. Candidate fills in name, email, uploads PDF
10. PDF is parsed IN THE BROWSER (pdfjs-dist) → raw text extracted
11. App calls POST /api/candidates with the resume text
    → Worker embeds resume using Workers AI
    → Queries Vectorize for semantic similarity vs job description
    → Calls Llama 3.1 LLM to score 0–100 with reasoning
    → Stores candidate in D1
    → Notifies LeaderboardDO via internal fetch
12. Candidate sees animated score circle immediately
---
13. LeaderboardDO receives the update
    → Sorts all candidates by score (tie → earliest time)
    → Persists to Durable Object storage
    → Broadcasts updated list over WebSocket to ALL connected dashboards
14. HR's dashboard updates live (no page refresh)
```

## Tech Stack and Why Each Technology Was Chosen

| Technology | Why Used |
|------------|----------|
| **React 19** | Industry-standard UI library. Component-based, fast, huge ecosystem. |
| **TypeScript** | Type safety across frontend and backend. Catches bugs at compile time. |
| **Hono** | Ultrafast web framework built for edge runtimes (Workers). Tiny bundle, Express-like API. |
| **Cloudflare Workers** | Serverless, runs at the edge (globally). No server management, instant scaling, 0ms cold starts. |
| **D1 (SQLite)** | Cloudflare's serverless SQL database. Perfect for relational data (jobs, candidates). |
| **Workers AI** | Cloudflare's AI inference. Runs `bge-base-en-v1.5` (embeddings) and `llama-3.1-8b-instruct-fast` (LLM) without external API keys or latency. |
| **Vectorize** | Cloudflare's vector database. Stores 768-dimensional embeddings for semantic similarity search. |
| **Durable Objects** | Cloudflare's stateful serverless primitive. Manages WebSocket connections for the live leaderboard. |
| **Vite** | Blazing fast frontend build tool. HMR in dev, optimized bundles in prod. |
| **pdfjs-dist** | Mozilla's PDF.js library. Parses PDF files entirely in the browser — no server upload of file bytes. |
| **React Router v7** | Client-side routing. Enables SPA navigation between /, /apply/:id, /dashboard/:id. |

## Alternative Technologies

| Current Choice | Alternatives | Why Current Is Better/Worse |
|---------------|--------------|------------------------------|
| Cloudflare Workers | AWS Lambda, Vercel Edge | Workers: zero cold start, cheaper, integrated with D1/DO/AI. Lambda: more mature ecosystem, better debugging. |
| Hono | Express, Fastify | Hono is built for edge/Workers. Express doesn't run on Workers natively. |
| D1 (SQLite) | PlanetScale, Supabase, Neon | D1 is tightly integrated with Workers — one platform. External DBs add latency. |
| Vectorize | Pinecone, Weaviate | Vectorize lives inside Cloudflare — no external API calls, lower latency. Pinecone is more mature. |
| Durable Objects | Redis Pub/Sub, Socket.io | DOs are co-located with Workers, no extra infra. Redis needs a separate server. |
| pdfjs-dist | Server-side PDF parsing | Browser-side keeps PDF bytes local (privacy) and reduces server bandwidth. |

---

# Part 2 — Folder Structure

```
hiring-screener/
├── migrations/          ← SQL schema files run against D1
├── public/              ← Static files copied as-is to dist
├── src/
│   ├── react-app/       ← All React frontend code
│   │   ├── pages/       ← One file per route/page component
│   │   ├── App.tsx      ← Router setup + Navbar
│   │   ├── main.tsx     ← React DOM entry point
│   │   ├── index.css    ← All styles (single global CSS file)
│   │   └── vite-env.d.ts← Vite type declarations
│   └── worker/          ← Cloudflare Worker backend
│       ├── routes/      ← Hono route handlers (jobs, candidates, auth)
│       ├── lib/         ← Shared utilities (auth middleware, password hashing)
│       ├── index.ts     ← Worker entry point (app setup, routing)
│       └── leaderboard-do.ts ← Durable Object class
├── index.html           ← SPA shell (just a <div id="root">)
├── wrangler.toml        ← Cloudflare deployment config (bindings, DB, etc.)
├── vite.config.ts       ← Vite + Cloudflare plugin config
├── tsconfig*.json       ← Multiple TS configs (app / node / worker)
├── package.json         ← Dependencies + scripts
├── .prettierrc          ← Code formatting rules
└── .editorconfig        ← Editor whitespace rules
```

### Why Each Folder Exists

**`src/react-app/`** — Completely separated from backend code. Has its own `tsconfig.app.json`. This separation ensures React code can use browser APIs (`window`, `document`) while worker code targets the Cloudflare runtime.

**`src/worker/`** — The Cloudflare Worker. Has its own `tsconfig.worker.json`. Compiles separately from the React app.

**`src/worker/routes/`** — Route handlers are separated by domain (jobs, candidates, auth). Without this, `index.ts` would be a 500-line file. Each file exports a Hono sub-app that gets mounted in `index.ts`.

**`src/worker/lib/`** — Shared logic (auth middleware, password hashing) that multiple route files can import. Without this, you'd duplicate the JWT verification code in every protected route.

**`migrations/`** — SQL files that define the database schema. Run manually with `wrangler d1 execute`. Versioned so you can track schema changes over time (`0001_init.sql` → `0002_auth.sql`).

**`public/`** — Files served verbatim. Currently only `vite.svg` (the favicon). Vite copies these to `dist/` unchanged.

---

# Part 3 — File-by-File Deep Dive

## `index.html`

```html
<div id="root"></div>
<script type="module" src="/src/react-app/main.tsx"></script>
```

**Why it exists:** Every SPA needs one HTML shell. The entire React app mounts into `<div id="root">`. The `type="module"` tells the browser this is an ES Module — modern JavaScript with `import/export`.

**Key detail:** `wrangler.toml` has `not_found_handling = "single-page-application"` which tells Cloudflare: for any URL that isn't a file, serve this `index.html`. This is how `/dashboard/abc123` works — Cloudflare serves `index.html`, React Router reads the URL, and renders the right page.

---

## `src/react-app/main.tsx`

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

**Every line explained:**

- `createRoot` — React 19's way to mount the app. Replaces old `ReactDOM.render`.
- `document.getElementById("root")!` — The `!` is TypeScript's non-null assertion. We're telling TS "trust me, this element exists." If it doesn't, the app crashes.
- `StrictMode` — Development-only wrapper. Makes React run effects twice to catch side effects bugs. Has zero impact in production.
- `BrowserRouter` — Enables React Router. Reads `window.location` and provides routing context to the entire app.
- `App` — The root component that contains all routes.

**What would happen without each piece:**
- Without `StrictMode`: Bugs from impure components are hidden.
- Without `BrowserRouter`: `useParams`, `Link`, `Routes` all crash.
- Without `createRoot`: You'd use the deprecated React 17 API.

---

## `src/react-app/App.tsx`

This file has two responsibilities: **the Navbar** and **the Router**.

### The Navbar Component

```tsx
function Navbar() {
  const { pathname } = useLocation();
  const isDash = pathname.startsWith("/dashboard");
  const isApply = pathname.startsWith("/apply");
  // ...
}
```

- `useLocation()` — React Router hook that returns the current URL. Used here to show different nav items depending on which page you're on.
- `isDash` / `isApply` — Boolean flags. The navbar is **context-aware**: on the dashboard it shows "+ Post a Job", on the apply page it shows "Candidate Application" as a non-clickable label.
- The logo is a `<Link to="/">` — clicking it always navigates home.

### The Router

```tsx
<Routes>
  <Route path="/" element={<PostJob />} />
  <Route path="/dashboard/:job_id" element={<Dashboard />} />
  <Route path="/apply/:job_id" element={<Suspense ...><ApplyJob /></Suspense>} />
  <Route path="*" element={<div>404</div>} />
</Routes>
```

- `Routes` — Renders only the first `<Route>` that matches the current URL.
- `:job_id` — A URL parameter. Whatever is in that segment of the URL becomes accessible as `useParams().job_id` inside the component.
- `path="*"` — Catch-all route. Renders a 404 page for any URL that doesn't match.
- `lazy(() => import("./pages/ApplyJob"))` — **Lazy loading**. `ApplyJob.tsx` imports `pdfjs-dist` which is a ~3MB library. Lazy loading means this 3MB chunk is only downloaded when a user visits `/apply/...`. The main bundle stays small.
- `<Suspense fallback={...}>` — Required wrapper for lazy-loaded components. Shows the fallback UI while the chunk is downloading.

**Architecture note:** `AuthPage`, `HRDashboard`, and `CandidateDashboard` pages exist in `src/react-app/pages/` but are **NOT routed here**. They are unfinished/incomplete features.

---

## `src/react-app/pages/PostJob.tsx`

This is the home page (`/`). It's a job creation form.

### State Variables

```tsx
const [title, setTitle] = useState("");          // Controlled input value
const [description, setDescription] = useState(""); // Controlled textarea value
const [loading, setLoading] = useState(false);   // Disables button during API call
const [error, setError] = useState("");          // Shows error message if API fails
const [result, setResult] = useState<...>(null); // Holds API response after success
const [copied, setCopied] = useState(false);     // "Copy Link" button feedback
```

**Controlled components:** Every `<input>` and `<textarea>` has its `value` tied to state and `onChange` updating state. React owns the form data — not the DOM. This is called a **controlled component** pattern.

### `handleSubmit` Function

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();   // Stops HTML form from refreshing the page
  setError("");         // Clear previous errors
  setLoading(true);
  try {
    const res = await fetch("/api/jobs", { method: "POST", ... });
    if (!res.ok) throw new Error(data.error ?? "Failed to create job");
    setResult(data);    // On success, switch to success view
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  } finally {
    setLoading(false);  // Always re-enable the button
  }
}
```

**Key patterns:**
- `e.preventDefault()` — Without this, the browser would reload the page on form submit.
- `try/catch/finally` — The `finally` block ALWAYS runs, even if there's an error. Perfect for resetting `loading` state.
- `res.ok` — Checks if HTTP status is 200–299. Always check this before parsing JSON.
- The component uses **conditional rendering**: `{!result ? <form> : <successView>}`. Once `result` is set, the form disappears and the success view appears.

### `copyLink` Function

```tsx
function copyLink() {
  void navigator.clipboard.writeText(applyLink);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
}
```

`void` discards the Promise (we don't need to await it). `setTimeout` provides the "Copied!" → "Copy Link" feedback loop.

---

## `src/react-app/pages/ApplyJob.tsx`

This is the most complex frontend page. Three phases: **load job info → parse PDF → submit and show score**.

### PDF Parsing with pdfjs-dist

```tsx
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
```

**Why the worker setup?** PDF.js uses a Web Worker (a background thread) to parse PDFs without blocking the UI. The `?url` suffix is a Vite feature — it imports the file as a URL string instead of its contents. This URL is given to PDF.js so it can load its worker thread from the correct location.

```tsx
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer(); // Convert File to raw bytes
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  for (let i = 1; i <= pdf.numPages; i++) {    // Pages are 1-indexed in PDF.js
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : "")) // Each item is a text chunk
      .join(" ");
    texts.push(pageText);
  }
  return texts.join("\n").trim();
}
```

**The loop:** PDFs are not one big text block — they are a collection of positioned text chunks. This loop goes page by page, grabs each text chunk, joins them with spaces, then joins pages with newlines.

**The guard:** `if (!text || text.length < 50)` — Scanned PDFs (images of text) return no extractable text. We reject them early with a helpful error message.

### Drag and Drop

```tsx
onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
onDrop={(e) => {
  e.preventDefault();
  const dropped = e.dataTransfer.files[0];
  // Simulates a change event and calls handleFileChange
}}
```

`e.preventDefault()` on `dragOver` is mandatory — without it, the browser tries to open the file itself. `e.dataTransfer.files` is where dragged files land.

### The Score Circle (SVG Math)

```tsx
const radius = 72;
const circ = 2 * Math.PI * radius;   // Circumference of the circle
const offset = circ - (result.score / 100) * circ;
```

This is a CSS `stroke-dasharray` technique:
- `stroke-dasharray={circ}` — Makes the stroke one continuous dash equal to the full circumference.
- `stroke-dashoffset={offset}` — Shifts the starting point. A score of 100 → offset 0 (full circle). A score of 50 → offset = half the circumference (half circle).
- `transition: stroke-dashoffset 1.2s` in CSS — Animates the circle filling up when the score appears.

---

## `src/react-app/pages/Dashboard.tsx`

The live leaderboard page. The most complex component.

### WebSocket Connection with Auto-Reconnect

```tsx
const wsRef = useRef<WebSocket | null>(null);
const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  function connect() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://.../api/leaderboard/${job_id}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onmessage = (event) => { /* update entries */ };
    ws.onclose = () => {
      setStatus("disconnected");
      reconnectTimer.current = setTimeout(connect, 3000); // Retry in 3s
    };
    ws.onerror = () => ws.close(); // Trigger onclose which handles retry
  }
  connect();

  return () => {
    wsRef.current?.close();
    clearTimeout(reconnectTimer.current); // Cleanup on unmount
  };
}, [job_id]);
```

**Why `useRef` for `wsRef`?** Refs persist across renders without causing re-renders. Storing a WebSocket in state would cause infinite re-render loops. Refs are for "things that exist outside of React's render cycle."

**Why the cleanup function?** The `return () => {...}` in `useEffect` runs when the component unmounts (user navigates away). Without cleanup, the WebSocket would keep running and trying to update state on an unmounted component.

**`wss` vs `ws`:** WebSockets use `ws://` for HTTP and `wss://` (secure) for HTTPS. Always use `wss://` in production.

### New Entry Highlight Animation

```tsx
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "leaderboard") {
    setEntries((prev) => {
      const prevIds = new Set(prev.map((e) => e.id));
      const fresh = incoming.filter((e) => !prevIds.has(e.id)).map((e) => e.id);
      if (fresh.length > 0) {
        setNewIds((ids) => {
          const next = new Set(ids);
          fresh.forEach((id) => next.add(id));
          setTimeout(() => {
            setNewIds((ids2) => { /* remove after 2s */ });
          }, 2000);
          return next;
        });
      }
      return incoming;
    });
  }
};
```

**Logic:** Compare incoming entries against previous entries. New candidates (IDs not seen before) get added to `newIds` Set. In the JSX, rows with IDs in `newIds` get `className="row-new"` which triggers a CSS animation (`fadeFromIndigo`). After 2 seconds, the IDs are removed from `newIds` and the animation stops.

### Filtering Logic

```tsx
const filteredEntries = entries.filter((entry) => {
  const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
  let matchesFit = true;
  if (fitFilter === "strong") matchesFit = entry.score >= 80;
  else if (fitFilter === "potential") matchesFit = entry.score >= 50 && entry.score < 80;
  else if (fitFilter === "no-match") matchesFit = entry.score < 50;
  return matchesSearch && matchesFit;
});
```

This filter runs on every render. It's computed directly (no `useMemo`) — fine for the scale of this app.

### Tie Detection

```tsx
const tied =
  (entryIndex > 0 && entries[entryIndex - 1].score === entry.score) ||
  (entryIndex < entries.length - 1 && entries[entryIndex + 1].score === entry.score);
```

A candidate is "tied" if their score equals the one above OR below them. The `=` badge is displayed next to tied ranks.

---

## `src/worker/index.ts`

The entry point of the Cloudflare Worker. This is what Cloudflare runs.

```typescript
const app = new Hono<{ Bindings: Env }>();
```

`Bindings: Env` — TypeScript generic that tells Hono what `c.env` contains (`DB`, `AI`, `VECTORIZE`, `LEADERBOARD`). The `Env` interface is auto-generated by `wrangler types`.

```typescript
app.use("/api/*", cors({ origin: "*", ... }));
```

CORS middleware runs before every `/api/` request. Without this, browsers would block requests from the frontend (different origin in development) to the backend.

```typescript
app.get("/api/leaderboard/:job_id/ws", async (c) => {
  const doId = c.env.LEADERBOARD.idFromName(jobId);
  const stub = c.env.LEADERBOARD.get(doId);
  return stub.fetch(c.req.raw);
});
```

**How Durable Objects work here:**
1. `idFromName(jobId)` — Deterministic ID from a string. Every call with the same `jobId` returns the same DO instance. This is how all dashboards for the same job connect to the same WebSocket hub.
2. `stub.fetch(c.req.raw)` — Forwards the entire HTTP request (including the WebSocket upgrade headers) to the DO.

```typescript
export { LeaderboardDO };
```

This re-export is REQUIRED. Cloudflare needs to see the DO class exported from the Worker's main module to wire up the binding.

---

## `src/worker/leaderboard-do.ts`

The Durable Object is a **stateful singleton** on Cloudflare's network. One instance per `job_id`.

### State Management

```typescript
private entries: LeaderboardEntry[] = [];  // In-memory, fast
private initialized = false;               // Lazy load flag
```

Durable Objects have both **in-memory state** (fast, lost on restart) and **storage** (persistent, async). The `ensureLoaded()` pattern loads from storage once, then keeps everything in memory for speed.

```typescript
private async ensureLoaded(): Promise<void> {
  if (this.initialized) return;            // Only load once
  const stored = await this.ctx.storage.get<LeaderboardEntry[]>("entries");
  this.entries = stored ?? [];             // Default to empty array
  this.initialized = true;
}
```

### WebSocket Hibernation API

```typescript
this.ctx.acceptWebSocket(server);          // Cloudflare Hibernation API
```

Standard WebSockets keep the DO active (and billing you) while clients are connected. The **Hibernation API** (`acceptWebSocket`) lets the DO "sleep" between messages. When a message arrives, Cloudflare wakes the DO and calls `webSocketMessage()`. This dramatically reduces cost for idle connections.

### Broadcasting

```typescript
for (const ws of this.ctx.getWebSockets()) {
  try {
    ws.send(message);
  } catch {
    // Client already disconnected — ignore
  }
}
```

`getWebSockets()` returns all active connections to this DO instance. This is how one candidate submitting triggers an update on ALL recruiter dashboards watching the same job.

### Sorting Logic

```typescript
this.entries.sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt);
```

Primary sort: score descending (`b.score - a.score`). If scores are equal, the `||` triggers the tiebreaker: submission time ascending (`a.submittedAt - b.submittedAt`). Earlier submission = higher rank.

---

## `src/worker/routes/jobs.ts`

### POST `/` — Create a Job

1. Validate inputs (title + description required).
2. `crypto.randomUUID()` — Generates a globally unique ID (built into Cloudflare runtime).
3. Insert into D1 with a prepared statement (prevents SQL injection).
4. Call Workers AI to embed the job description → 768-dimensional vector.
5. Upsert vector into Vectorize with metadata `{ job_id, type: "job_description" }`.
6. Return `{ job_id, title }` with status 201 Created.

**Why embed the JD?** Later, when a candidate submits, we query Vectorize for vectors similar to the resume embedding, filtered to this `job_id`. That gives us a semantic similarity score.

### GET `/:id` — Fetch a Job

Simple D1 lookup. Used by `ApplyJob.tsx` to display the job title at the top of the application form.

---

## `src/worker/routes/candidates.ts`

This is the most important backend file — the AI scoring pipeline.

### The 6-Step Pipeline

**Step 1 — Validate inputs:** `job_id`, `name`, `email`, `resume_text` all required.

**Step 2 — Fetch job from D1:** Confirms the job exists. Returns 404 if not.

**Step 3 — Embed the resume:**
```typescript
const resumeEmbedResponse = await c.env.AI.run("@cf/baai/bge-base-en-v1.5", {
  text: [body.resume_text]
});
const resumeEmbedding = resumeEmbedResponse.data[0]; // 768-dim float array
```

**Step 4 — Semantic similarity via Vectorize:**
```typescript
const vectorQuery = await c.env.VECTORIZE.query(resumeEmbedding, {
  topK: 1,
  filter: { job_id: body.job_id },  // Only compare against THIS job's JD
  returnMetadata: "all",
});
semanticScore = Math.round(vectorQuery.matches[0].score * 100);
```
Vectorize returns cosine similarity (0–1). We multiply by 100 to get a 0–100 score.

**Step 5 — LLM scoring (primary):**
```typescript
const prompt = `You are a hiring assistant. Given this Job Description and Resume,
score the candidate from 0-100 and give 2 line reasoning.
Return ONLY valid JSON: { "score": number, "reasoning": string }

JD: ${job.description}
Resume: ${body.resume_text}`;
```

The LLM returns JSON. The code has robust fallback parsing:
- First tries `resp.response` as a pre-parsed object (newer model API).
- Falls back to extracting JSON from a text response with a regex: `/\{[\s\S]*\}/`.
- Validates that score is 0–100 before using it.

**Step 6 — Store + notify:**
- Insert candidate into D1.
- Fetch the LeaderboardDO's `/update` endpoint with the candidate data.
- Return `{ candidate_id, score, reasoning }` to the frontend.

---

## `src/worker/lib/auth.ts`

Authentication utilities. **Not yet used in the live app** but fully implemented.

### JWT Middleware

```typescript
export const authenticate = () =>
  createMiddleware(async (c, next) => {
    const token = authHeader.substring(7); // Remove "Bearer "
    const payload = await verify(token, jwtSecret, "HS256");
    c.set("user", { id: payload.userId, role: payload.role });
    await next(); // Pass control to the next handler
  });
```

`createMiddleware` is Hono's factory for typed middleware. `c.set()` stores data in the request context so downstream handlers can call `c.get("user")`.

### PBKDF2 Password Hashing

```typescript
const salt = crypto.getRandomValues(new Uint8Array(16));  // Random 16-byte salt
const derivedBits = await crypto.subtle.deriveBits({
  name: "PBKDF2",
  salt: salt,
  iterations: 100000,   // 100k iterations makes brute-force slow
  hash: "SHA-256",
}, importKey, 256);
return `${saltHex}:${hashHex}`; // Store as "salt:hash"
```

**Why PBKDF2?** Plain hashing (MD5, SHA-256) is fast — bad for passwords because attackers can try millions per second. PBKDF2 with 100,000 iterations is intentionally slow, making brute-force attacks ~100,000x harder. The salt prevents rainbow table attacks (two users with the same password get different hashes).

---

## `migrations/0001_init.sql`

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,          -- UUID string
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,         -- Foreign key to jobs
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  resume_text TEXT NOT NULL,    -- Full extracted text (can be large)
  score REAL DEFAULT 0,         -- 0.0 to 100.0
  reasoning TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
```

**Design notes:**
- UUIDs as primary keys (TEXT) instead of auto-increment integers — avoids exposing record count, better for distributed systems.
- `resume_text TEXT` — Stores the full resume. This could be very large. A production optimization would store only a summary.
- `FOREIGN KEY` — Enforces that every candidate must reference a valid job.

## `migrations/0002_auth.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,           -- 'HR' or 'candidate'
  company_name TEXT,            -- Nullable (candidates don't have companies)
  email TEXT NOT NULL UNIQUE,   -- UNIQUE constraint prevents duplicate accounts
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE jobs ADD COLUMN user_id TEXT REFERENCES users(id);
```

**Not yet applied in the live app** — the auth system is implemented but not wired in.

---

# Part 4 — React Concepts

## Why Functional Components?

This project uses **only functional components** (no class components). Modern React (since v16.8) encourages functional components + hooks over class components because:
- Less boilerplate
- Easier to read and test
- Hooks enable sharing stateful logic between components

## JSX

JSX is NOT HTML. It compiles to `React.createElement()` calls. Example from `PostJob.tsx`:
```tsx
<button disabled={loading}>Submit</button>
// compiles to:
React.createElement("button", { disabled: loading }, "Submit")
```

## Props

Props are inputs to a component. In this project, `Navbar` takes no props (it reads from the router context directly). `Dashboard` gets `job_id` from `useParams()` (URL params), not props.

## useState

Every form input, loading state, and result in this project uses `useState`. Remember: calling a setter triggers a re-render.

## useEffect

Used in two components:
1. **`ApplyJob`** — Fetches job details on mount: `useEffect(() => { fetch(...) }, [job_id])`. The `[job_id]` dependency array means "re-run this if job_id changes."
2. **`Dashboard`** — Opens the WebSocket on mount, cleans up on unmount.

**The rules of `useEffect`:**
- `[]` — Runs once after mount.
- `[someValue]` — Runs after mount AND whenever `someValue` changes.
- No array — Runs after EVERY render (usually a bug).
- Cleanup function — Return a function to clean up (close WS, cancel timers).

## useRef

Used in `Dashboard.tsx` for `wsRef` and `reconnectTimer`. Refs are for values that:
1. Need to persist across renders
2. Should NOT trigger a re-render when changed

Also used in `ApplyJob.tsx` as `fileInputRef` to programmatically clear the file input (`fileInputRef.current.value = ""`).

## Lazy Loading

```tsx
const ApplyJob = lazy(() => import("./pages/ApplyJob"));
```

`pdfjs-dist` is ~3MB. Without lazy loading, every visitor downloads this even if they never apply for a job. With lazy loading, only users who visit `/apply/...` download it.

## React Router

- `BrowserRouter` — Uses the History API. URLs look like `/dashboard/abc123`.
- `Routes` + `Route` — Declarative routing.
- `useParams<{ job_id: string }>()` — Extracts `:job_id` from the URL.
- `useLocation()` — Returns the current URL object.
- `Link` — Renders an `<a>` that navigates without page reload.

---

# Part 5 — Backend Architecture

## Hono Framework

Hono is an Express-like framework that runs on Cloudflare Workers. Key concepts:

```typescript
const app = new Hono<{ Bindings: Env }>();
app.get("/path", (c) => c.json({ ok: true }));
app.post("/path", async (c) => {
  const body = await c.req.json();
  return c.json({ result: "..." }, 201);
});
```

`c` is the **context** object. It carries: `c.req` (request), `c.env` (bindings like DB, AI), `c.json()` (response helper), `c.set/get()` (middleware data sharing).

## Route Mounting

```typescript
app.route("/api/jobs", jobs);       // Mounts jobs.ts at /api/jobs
app.route("/api/candidates", candidates); // Mounts candidates.ts at /api/candidates
```

`app.route()` prefixes all routes in the sub-app. A `jobs.post("/")` becomes `POST /api/jobs`.

## Middleware

CORS middleware runs on `app.use("/api/*", cors(...))` — before all API routes. The auth middleware in `lib/auth.ts` is built but not yet applied to routes in `index.ts`.

## Error Handling

Each handler has its own try/catch. There's no global error handler (a potential improvement). Errors return JSON: `c.json({ error: "message" }, statusCode)`.

## Response Structure

All API responses are JSON:
- Success: `{ data fields... }` with 200 or 201
- Error: `{ error: "message" }` with 400, 401, 403, 404, or 500

---

# Part 6 — Database

## D1 (SQLite on Cloudflare)

D1 is Cloudflare's SQLite-based serverless database. It lives at the edge, co-located with Workers.

## Schema Design

**`jobs` table:** Stores job postings. `id` is a UUID. `description` is the full job description text (used for LLM scoring and embedding).

**`candidates` table:** Stores applications. One-to-many with jobs (`job_id` foreign key). Stores `resume_text` (full text), `score` (0–100 float), and `reasoning` (LLM explanation).

**`users` table (migration 2):** For future auth. Stores both HR and candidate accounts. `role` field distinguishes them. `email` has a UNIQUE constraint.

## Prepared Statements

```typescript
await c.env.DB.prepare("INSERT INTO jobs (id, title, description) VALUES (?, ?, ?)")
  .bind(jobId, body.title, body.description)
  .run();
```

Always use prepared statements with `?` placeholders. Never string-concatenate user input into SQL. Prepared statements prevent SQL injection.

## CRUD Operations Used

| Operation | Where |
|-----------|-------|
| INSERT jobs | `routes/jobs.ts` POST |
| SELECT jobs | `routes/jobs.ts` GET /:id, `routes/candidates.ts` |
| INSERT candidates | `routes/candidates.ts` POST |
| INSERT users | `routes/auth.ts` register |
| SELECT users | `routes/auth.ts` login |

## Possible Optimizations

1. Add an index on `candidates.job_id` for faster leaderboard queries.
2. Add an index on `users.email` (already has UNIQUE, which creates an implicit index).
3. Don't store full `resume_text` in D1 — store in R2 (object storage) and keep only a hash/reference.
4. Paginate the candidates query for large datasets.

---

# Part 7 — APIs

## `GET /api/health`

**Purpose:** Liveness check. Monitoring tools ping this to verify the worker is running.
**Request:** None
**Response:** `{ "status": "ok", "service": "hiresight" }`

---

## `POST /api/jobs`

**Purpose:** Create a job posting.
**Request body:** `{ "title": "string", "description": "string" }`
**Response (201):** `{ "job_id": "uuid", "title": "string" }`
**Response (400):** `{ "error": "title and description are required" }`

**Side effects:**
- Inserts into D1 `jobs` table
- Generates embedding via Workers AI
- Upserts embedding into Vectorize

---

## `GET /api/jobs/:id`

**Purpose:** Fetch a single job's details (used by the Apply page to show job title).
**Response (200):** `{ "id": "...", "title": "...", "description": "..." }`
**Response (404):** `{ "error": "Job not found" }`

---

## `POST /api/candidates`

**Purpose:** Submit a resume application and receive an AI score.
**Request body:**
```json
{
  "job_id": "uuid",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "resume_text": "full extracted text..."
}
```
**Response (201):**
```json
{
  "candidate_id": "uuid",
  "score": 87,
  "reasoning": "Strong match on Python and ML experience..."
}
```

**Side effects:** Inserts into D1, upserts into Vectorize, notifies LeaderboardDO.

---

## `GET /api/leaderboard/:job_id`

**Purpose:** REST snapshot of the leaderboard (for initial page load without WebSocket).
**Response:** `{ "entries": [{ "id", "name", "score", "reasoning", "submittedAt" }] }`

---

## `GET /api/leaderboard/:job_id/ws`

**Purpose:** WebSocket upgrade for live leaderboard.
**Protocol:** Upgrades to WebSocket. Proxies to `LeaderboardDO`.
**Messages from server:**
```json
{ "type": "leaderboard", "entries": [...] }
```
**Messages from client:**
```json
{ "type": "ping" }
```

---

# Part 8 — Authentication & Security

## Current State

The live app has **no authentication**. Anyone who knows a `job_id` can view the dashboard or submit as a candidate. Authentication code exists in `src/worker/lib/auth.ts` and `src/worker/routes/auth.ts` but is not mounted in `index.ts`.

## Implemented (But Inactive) Auth System

### Registration/Login Flow
1. User POSTs email + password to `/api/auth/register/hr` or `/api/auth/register/candidate`
2. Password is hashed with PBKDF2 (100,000 iterations + random salt)
3. User record inserted into D1 `users` table
4. JWT token returned: `{ token, role, name, userId }`
5. Client stores token in `localStorage`
6. Future requests include `Authorization: Bearer <token>` header
7. `authenticate()` middleware verifies the JWT on protected routes

### JWT Structure
```json
{
  "userId": "uuid",
  "role": "HR",
  "exp": 1234567890    // Unix timestamp — 24h from now
}
```

Signed with `HS256` (HMAC-SHA256). The `JWT_SECRET` is stored as a Worker secret (environment variable).

## Security: What This Project Does Right

- **PBKDF2 password hashing** — Proper industry-standard password storage.
- **Prepared statements** — SQL injection prevented on all DB queries.
- **JWT expiration** — Tokens expire after 24 hours.
- **Input validation** — Every endpoint checks required fields before processing.
- **Role-based middleware** — `requireHR()` and `requireCandidate()` middlewares ready.

## Security: What's Missing or Weak

| Issue | Risk | Fix |
|-------|------|-----|
| No auth on live routes | Anyone can post jobs or submit candidates | Mount auth middleware |
| `JWT_SECRET` has a default value | Predictable secret if not overridden | Enforce non-default in production |
| CORS `origin: "*"` | Any website can call your API | Lock to specific domain in production |
| No rate limiting | Unlimited candidate submissions | Add rate limiting middleware |
| No input sanitization | XSS if reasoning/names rendered as HTML | React escapes JSX output by default — OK here |
| `localStorage` for JWT | XSS can steal the token | Use httpOnly cookies instead |
| Full resume in D1 | Large storage, potential data leak | Encrypt or store in R2 |

## CORS Explained

Cross-Origin Resource Sharing. Browsers block requests from `example.com` to `api.example.com` unless the API explicitly allows it. The `cors()` middleware adds `Access-Control-Allow-Origin: *` headers.

---

# Part 9 — Styling

## Architecture: Single Global CSS File

All 851 lines of CSS live in `src/react-app/index.css`. No CSS modules, no Tailwind. CSS custom properties (variables) provide the design system.

## Design System via CSS Variables

```css
:root {
  --bg: #070913;              /* Deep dark background */
  --brand: #6366f1;           /* Indigo — primary color */
  --brand-gradient: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
  --green: #10b981;           /* Score ≥80 */
  --yellow: #f59e0b;          /* Score 50–79 */
  --red: #f43f5e;             /* Score <50 */
  --radius: 16px;             /* Card border radius */
}
```

**Why variables?** Change `--brand` in one place and the entire app updates. No find-and-replace.

## Glassmorphism Cards

```css
.card {
  background: rgba(15, 23, 42, 0.55);   /* Semi-transparent */
  backdrop-filter: blur(16px);           /* Frosted glass blur */
  border: 1px solid rgba(255,255,255,0.07); /* Subtle border */
}
```

`backdrop-filter: blur()` creates the "glass" effect — blurs whatever is behind the element.

## Typography

Uses **Plus Jakarta Sans** from Google Fonts. Loaded via `@import url(...)` at the top of the CSS. `clamp(2.2rem, 5vw, 3.2rem)` on the hero heading — fluid typography that scales with viewport width.

## Animations

Three key animations:
1. **`fadeIn`** — Every page fades in with a slight upward movement.
2. **`pulse`** — The green "LIVE" dot pulses to indicate active connection.
3. **`fadeFromIndigo`** — New leaderboard rows highlight indigo then fade out.
4. **`spin`** — Loading spinner.
5. **SVG stroke animation** — The score circle fills up on the Apply result page.

## Responsive Design

```css
@media (max-width: 768px) {
  .stats-row { grid-template-columns: 1fr; } /* Stack stats vertically */
  .hero h1 { font-size: 2rem; }
  .dash-header { flex-direction: column; }
  .filter-bar { flex-direction: column; }
}
```

Breakpoint at 768px (tablet/mobile). CSS Grid and Flexbox handle layout at both sizes.

---

# Part 10 — Performance

## Bundle Optimization

**Lazy loading `ApplyJob`:** The `pdfjs-dist` library is ~3MB. Without lazy loading, every page load downloads it. With `lazy()`, it's only downloaded when a user visits `/apply/...`.

```tsx
const ApplyJob = lazy(() => import("./pages/ApplyJob"));
```

## Cloudflare Edge Delivery

Static assets (`dist/client/`) are served from Cloudflare's CDN — distributed globally. Users get assets from the nearest data center.

## WebSocket vs Polling

The leaderboard uses WebSocket instead of polling (`setInterval` + `fetch`). A poll every 2 seconds would generate 30 API calls per minute per user. WebSocket uses a single persistent connection — updates are pushed by the server only when there's new data.

## Durable Object Hibernation

`acceptWebSocket()` (Hibernation API) lets the DO sleep between WebSocket messages. Without hibernation, every idle connection keeps the DO running and billing. With hibernation, idle cost is near zero.

## Potential Bottlenecks

1. **`resume_text` in D1** — Large text fields slow down reads. Store in R2.
2. **LLM scoring latency** — Llama 3.1 call can take 2–5 seconds. Consider showing a loading state with intermediate feedback.
3. **No `useMemo` on `filteredEntries`** — Fine for <1000 candidates. For larger datasets, memoize the filter.
4. **PDF parsing blocks UI slightly** — Happens in a Web Worker (via pdfjs), so it shouldn't freeze, but very large PDFs could.
5. **No pagination** — The leaderboard loads all candidates. At 10,000+ candidates, this becomes a problem.

---

# Part 11 — Design Decisions

## Why Browser-Side PDF Parsing?

**Alternatives:** Send the PDF to the server, parse server-side.

**Why browser-side is better here:**
- Privacy: The raw PDF bytes never leave the user's device. Only the extracted text is sent.
- Cost: No bandwidth for uploading large PDFs to the server.
- Complexity: No file upload handling, no storage for PDFs.

**Downside:** Scanned PDFs (images) can't be parsed. Users are shown a helpful error.

## Why Durable Objects for the Leaderboard?

**Alternatives:** Server-Sent Events (SSE), polling, Redis Pub/Sub.

**Why DOs:**
- No external infra — everything on Cloudflare.
- DOs maintain the sorted leaderboard state in memory and persist it to storage.
- One DO instance per `job_id` — natural fan-out. All clients watching the same job connect to the same DO.

**Trade-off:** DOs are harder to debug than a Redis pub/sub setup. Also, DOs are a Cloudflare-specific concept — if you migrate away from Cloudflare, you'd need to rewrite this.

## Why Hono Instead of itty-router or raw Request handling?

Hono provides:
- Route parameters (`:job_id`)
- JSON body parsing (`c.req.json()`)
- CORS middleware
- JWT middleware (built-in)
- TypeScript generics for bindings and variables

Raw `Request` handling would require reimplementing all of this.

## Why One Global CSS File?

**Alternative:** CSS Modules, Tailwind, styled-components.

**Pros of single file:**
- Simple — no build-time CSS module mapping.
- CSS variables provide the design system.

**Cons:**
- Not scalable. At 20+ pages, a single CSS file becomes hard to maintain.
- No component-level isolation — class name collisions possible.
- For a production app, Tailwind or CSS Modules would be better.

## Two-Stage AI Scoring (Vector + LLM)

**Stage 1 (Vectorize):** Fast, cheap, purely mathematical. Measures word/semantic overlap.
**Stage 2 (LLM):** Slower, expensive, but understands context. A candidate can score 30 on vector similarity but 85 on LLM if their experience is highly relevant even if the words differ.

**The LLM score overrides the vector score** when available. Vector is the fallback if Vectorize is unavailable (e.g., local dev).

---

# Part 12 — Libraries

## `hono` (^4.11.1)

**What:** Web framework for edge runtimes.
**Why:** Native Cloudflare Workers support. Built-in JWT, CORS, request parsing. Express doesn't run on Workers.
**Used in:** `src/worker/index.ts`, all route files, `src/worker/lib/auth.ts`.
**Could remove?** No — you'd have to write all routing from scratch.

## `pdfjs-dist` (^6.0.227)

**What:** Mozilla's PDF rendering/parsing library.
**Why:** Parse PDFs in the browser. No alternative runs client-side with this level of text extraction quality.
**Used in:** `src/react-app/pages/ApplyJob.tsx`.
**Could remove?** Only if you switch to server-side PDF parsing.

## `react` (^19.2.1) + `react-dom` (^19.2.1)

**What:** The UI library.
**Why:** Industry standard. Component-based, hooks, huge ecosystem. React 19 is the latest stable.
**Used everywhere** in `src/react-app/`.

## `react-router-dom` (^7.9.4)

**What:** Client-side routing for React.
**Why:** Enables SPA navigation. Provides `Routes`, `Route`, `Link`, `useParams`, `useLocation`.
**Used in:** `App.tsx`, `PostJob.tsx`, `Dashboard.tsx`.
**Could remove?** Could use Next.js file-based routing, but this project isn't on Next.js.

## `@cloudflare/vite-plugin` (^1.15.3) — devDependency

**What:** Vite plugin that enables Cloudflare Workers integration during development.
**Why:** Lets you run the Worker locally with `vite dev`. Also handles the production build that bundles Worker + React app together.
**Used in:** `vite.config.ts`.
**Could remove?** No — without it you can't develop or build the Worker + React together.

## `@vitejs/plugin-react` (^5.1.1) — devDependency

**What:** Vite plugin for React — adds JSX transform, HMR.
**Why:** Without it, Vite doesn't know how to handle `.tsx` files or fast refresh.
**Used in:** `vite.config.ts`.

## `typescript` (^5.9.3) — devDependency

**What:** TypeScript compiler.
**Why:** Type safety. Catches bugs at compile time. Required for the TypeScript source files.

## `vite` (^7.0.0) — devDependency

**What:** Build tool and dev server.
**Why:** Extremely fast HMR in development. Produces optimized bundles. Works with the Cloudflare plugin.

## `wrangler` (^4.100.0) — devDependency

**What:** Cloudflare's CLI tool.
**Why:** Deploy Workers, manage D1 migrations, run local dev server, generate TypeScript types.
**Used via:** `npm run deploy`, `npm run cf-typegen`, `npm run db:migrate:*`.

---

# Part 13 — Configuration

## `package.json` Scripts

| Script | What It Does |
|--------|-------------|
| `npm run dev` | Starts Vite dev server + Worker locally |
| `npm run build` | TypeScript check + Vite production build |
| `npm run deploy` | Deploys the built app to Cloudflare Workers |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` from `wrangler.toml` |
| `npm run db:migrate:local` | Runs `0001_init.sql` against local D1 |
| `npm run db:migrate:remote` | Runs `0001_init.sql` against production D1 |

## `wrangler.toml`

```toml
name = "hiresight"                          # Worker name / URL subdomain
main = "src/worker/index.ts"               # Entry point
compatibility_date = "2026-06-13"          # Workers runtime version
compatibility_flags = ["nodejs_compat"]    # Enables Node.js APIs (crypto, etc.)

[assets]
directory = "./dist/client"                # Serve React SPA from here
not_found_handling = "single-page-application" # Serve index.html for 404s

[ai]
binding = "AI"                             # c.env.AI

[[d1_databases]]
binding = "DB"                             # c.env.DB
database_name = "hiring_db"
database_id = "f3d55b49-..."

[[vectorize]]
binding = "VECTORIZE"                      # c.env.VECTORIZE
index_name = "resumes_index"

[durable_objects]
bindings = [{ name = "LEADERBOARD", class_name = "LeaderboardDO" }]
```

## `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react(), cloudflare()],
});
```

Two plugins:
- `react()` — JSX, HMR
- `cloudflare()` — Worker bundling, dev proxy between React and Worker

## TypeScript Configuration (3 configs)

The project has three separate `tsconfig` files because the code runs in three different environments:

| Config | Environment | Target | Includes |
|--------|------------|--------|---------|
| `tsconfig.app.json` | Browser | ES2020 | `src/react-app/` |
| `tsconfig.node.json` | Node.js | ES2023 | `vite.config.ts` |
| `tsconfig.worker.json` | Workers runtime | ES2023 | `src/worker/` |

The root `tsconfig.json` just references all three — it's a TypeScript "solution" style config.

**Why separate configs?** Browser code needs `DOM` types. Worker code needs `D1Database`, `VectorizeIndex` types. If you mixed them, TypeScript would complain about `window` in Worker code or `DurableObject` in browser code.

## `.prettierrc`

```json
{
  "printWidth": 140,
  "singleQuote": true,
  "semi": true,
  "useTabs": true
}
```

Enforces consistent code style. Tabs for indentation, single quotes, semicolons, 140-character lines.

## `.editorconfig`

Same rules for editors that don't use Prettier. Ensures consistent line endings (`lf`) and charset (`utf-8`).

---

# Part 14 — Git & Deployment

## Build Process

```
npm run build
  └── tsc -b           # Type-checks all 3 tsconfigs
  └── vite build
        ├── Builds React app → dist/client/     (static assets)
        └── Bundles Worker  → dist/worker.js    (single Worker script)
```

## Development Workflow

```bash
npm run dev
```

Starts Vite's dev server. The `@cloudflare/vite-plugin` runs a local Cloudflare Workers runtime alongside. API calls (`/api/*`) are proxied to the local Worker. Hot Module Replacement (HMR) refreshes the React app on file saves.

## Production Deployment

```bash
npm run deploy
# Which runs:
wrangler deploy
```

Wrangler:
1. Bundles the Worker with esbuild
2. Uploads the Worker script to Cloudflare
3. Uploads `dist/client/` as static assets to Cloudflare's CDN

**Live URL:** `https://hiring-screener.shashishanthan2706.workers.dev`

## Environment Variables / Secrets

- `JWT_SECRET` — Must be set as a Wrangler secret: `wrangler secret put JWT_SECRET`
- `.dev.vars` — Local development secrets (like `.env`). Listed in `.gitignore` — NEVER commit.
- The `.gitignore` includes `.dev.vars*` so secrets stay off Git.

## Database Migrations

```bash
# Local (development)
npm run db:migrate:local  # Runs 0001_init.sql against local D1

# Production
npm run db:migrate:remote  # Runs 0001_init.sql against production D1
```

**Important:** Migration 2 (`0002_auth.sql`) has no npm script — you'd need to run it manually with `wrangler d1 execute hiring_db --remote --file=./migrations/0002_auth.sql`.

---

# Part 15 — Interview Questions

## HR-Friendly / Behavioral

1. **"Walk me through what HireSight does in one minute, as if you're pitching it to a non-technical person."**
2. **"What problem were you trying to solve when you built this?"**
3. **"What was the hardest part of building this project?"**
4. **"If you had 2 more weeks, what would you add to HireSight?"**
5. **"Why did you choose to build this on Cloudflare instead of AWS or Vercel?"**
6. **"How did you come up with the two-stage AI scoring approach?"**

## Technical — Architecture

7. **"Explain the overall system architecture."**
8. **"What is a Cloudflare Worker and how is it different from a traditional Node.js server?"**
9. **"What is a Durable Object and why did you use it for the leaderboard?"**
10. **"Why does the leaderboard use WebSocket instead of polling?"**
11. **"What happens if the Durable Object restarts? Does the leaderboard data survive?"**
12. **"Why are there two AI scoring steps (vector similarity + LLM)?"**
13. **"What is Vectorize and what problem does it solve?"**
14. **"How does the app handle multiple recruiters viewing the same job's dashboard simultaneously?"**
15. **"Why is the React app served as a SPA and what does `not_found_handling = "single-page-application"` do?"**

## Technical — React

16. **"Why did you use `useRef` for the WebSocket instead of `useState`?"**
17. **"Explain why `ApplyJob` is lazy loaded but `PostJob` and `Dashboard` are not."**
18. **"What is the cleanup function in `useEffect` and why is it important in the Dashboard?"**
19. **"How does the new-entry highlight animation work? Walk me through the code."**
20. **"What is a controlled component? Give an example from your code."**
21. **"Why does the `useEffect` in Dashboard have `[job_id]` as its dependency array?"**
22. **"What would happen if you forgot `e.preventDefault()` in the form submit handlers?"**
23. **"How does the score circle SVG animation work mathematically?"**
24. **"What is React StrictMode and why is it used?"**

## Technical — Backend

25. **"How does Hono's `app.route()` work?"**
26. **"Walk me through what happens from the moment a candidate clicks Submit to when their score appears on the leaderboard."**
27. **"Why do you use `crypto.randomUUID()` instead of auto-increment IDs?"**
28. **"What is the difference between `idFromName()` and `idFromString()` on a Durable Object namespace?"**
29. **"Why is the Leaderboard DO update wrapped in a try/catch that silently swallows errors?"**
30. **"Explain how the LLM response parsing handles different response formats."**

## Technical — Database

31. **"Why does the candidates table store the full resume_text instead of a file reference?"**
32. **"What would happen if two people with the same email tried to register? Which database constraint prevents this?"**
33. **"Why use TEXT for primary keys instead of INTEGER?"**
34. **"What is a FOREIGN KEY constraint and what does it enforce in the candidates table?"**
35. **"How would you add pagination to the leaderboard?"**

## API

36. **"What HTTP status code does job creation return and why 201 instead of 200?"**
37. **"Why does `POST /api/candidates` trigger a Durable Object update instead of serving the leaderboard directly from D1?"**
38. **"How would you add rate limiting to the candidate submission endpoint?"**
39. **"The CORS config uses `origin: "*"`. What's the security risk and how would you fix it in production?"**

## Security

40. **"Why is PBKDF2 better than SHA-256 for storing passwords?"**
41. **"What is a rainbow table attack and how does the salt in your password hashing prevent it?"**
42. **"The JWT secret has a default value. What's the risk and how do you fix it?"**
43. **"Why is storing JWTs in localStorage considered less secure than httpOnly cookies?"**
44. **"Is your app vulnerable to SQL injection? Why or why not?"**

## Performance

45. **"What is lazy loading and which component uses it here? Why that one?"**
46. **"How does the WebSocket Hibernation API reduce Durable Object billing costs?"**
47. **"Where would you add `useMemo` if the leaderboard had 10,000 candidates?"**
48. **"Why does the PDF parsing happen in the browser instead of the server?"**

## Debugging / Edge Cases

49. **"What happens if the LLM returns malformed JSON?"**
50. **"What happens if a candidate uploads a scanned PDF (image-based)?"**
51. **"What happens if the WebSocket disconnects? How does the Dashboard recover?"**
52. **"What happens if two candidates submit simultaneously?"**
53. **"What happens if Vectorize is unavailable (e.g., local dev)?"**
54. **"The auth system is built but not wired in. How would you safely add it without breaking the existing flow?"**

## Scaling

55. **"How would HireSight behave under 10,000 simultaneous candidate submissions?"**
56. **"What are the limits of storing all candidates in a single Durable Object?"**
57. **"How would you add email notifications when a new top candidate appears?"**
58. **"If you had to support 1 million jobs and 10 million candidates, what would you redesign?"**

---

# Part 16 — Mock Interview Guide

**How to use this section:** Cover up the "Ideal Answer" for each question. Write your own answer first. Then compare.

---

### Q1: "Walk me through the complete flow when a candidate submits their resume."

**Your answer first. Then compare:**

**Ideal Answer:**
> "The candidate opens the apply link `/apply/{job_id}`. When the page loads, it fetches the job title from `GET /api/jobs/:id`. The candidate fills in their name, email, and uploads a PDF. The PDF is parsed entirely in the browser using `pdfjs-dist` — we loop through every page, extract text chunks, and join them into a plain text string. Once parsed, the candidate clicks Submit, which calls `POST /api/candidates` with their name, email, job_id, and the extracted text.
>
> On the backend, the Worker validates inputs, fetches the job from D1, then runs a two-stage AI scoring. First, it embeds the resume using `bge-base-en-v1.5` (768-dimensional vector) and queries Vectorize for semantic similarity against the job description's embedding — that gives a rough 0–100 score. Second, it sends both the job description and resume to `llama-3.1-8b-instruct-fast` with a prompt asking for a 0–100 score and 2-line reasoning in JSON format. The LLM score overrides the vector score if successful.
>
> The candidate record is then stored in D1, and an internal fetch notifies the LeaderboardDO with the new entry. The DO sorts all entries by score (ties broken by submission time), persists to Durable Object storage, and broadcasts the updated leaderboard over WebSocket to all connected recruiters. Meanwhile, the frontend receives the `{ candidate_id, score, reasoning }` response and shows the animated score circle."

---

### Q2: "Why did you use a Durable Object for the leaderboard instead of just reading from D1?"

**Ideal Answer:**
> "D1 is great for persistent storage but it's not designed for real-time pub/sub. If I used D1, the recruiter's dashboard would have to poll `GET /api/candidates?job_id=...` every few seconds — inefficient and slow. A Durable Object gives me two things: persistent state (the sorted leaderboard survives restarts) AND a WebSocket hub. Multiple recruiters connect to the same DO instance (identified by `job_id`), and when any candidate submits, the DO broadcasts to all of them simultaneously. It's effectively a real-time message bus with built-in persistence."

---

### Q3: "What would break if you removed the `export { LeaderboardDO }` line from `index.ts`?"

**Ideal Answer:**
> "The Durable Object class would not be exported from the Worker's main module. Cloudflare's runtime requires all Durable Object classes to be exported from the entry point so it can instantiate them when a request comes in. Without that export, any request to `/api/leaderboard/:job_id/ws` would crash with a 'Durable Object class not found' error."

---

### Q4: "Your CORS is set to `origin: "*"`. A security reviewer flags this. What do you tell them?"

**Ideal Answer:**
> "In development, `*` is acceptable because we don't know the frontend URL. In production, this should be locked to the specific domain — for example, `origin: 'https://hiring-screener.shashishanthan2706.workers.dev'`. With `*`, any website can make API calls to our backend on behalf of a logged-in user. Once we add auth, this becomes a real CSRF-adjacent risk. I'd also add `allowHeaders: ['Content-Type', 'Authorization']` since JWT auth uses the Authorization header."

---

# Part 17 — Weakness Detection Checklist

Go through each area. Be honest about which ones you'd struggle to explain.

### Concepts to Master

- [ ] **What is a Cloudflare Worker?** — Serverless function running on V8 isolates, not Node.js. No persistent state, very short CPU time limits.
- [ ] **What is a Durable Object?** — A stateful singleton that runs alongside Workers. One instance per named key. Has storage, WebSocket capabilities, and in-memory state.
- [ ] **What is Vectorize?** — A vector database. Stores n-dimensional float arrays. Used for semantic search (find things that mean the same, not just same words).
- [ ] **What is an embedding?** — A vector representation of text. Similar texts have similar vectors (close in high-dimensional space). `bge-base-en-v1.5` converts text to 768-dimensional vectors.
- [ ] **Why `useRef` vs `useState` for WebSocket?** — State changes trigger re-renders. A WebSocket re-render would close and reopen the connection. Refs persist without triggering renders.
- [ ] **Explain `useEffect` cleanup.** — The return function runs on unmount. Without it, the WebSocket would keep running after navigation.
- [ ] **What is PBKDF2?** — Password-Based Key Derivation Function 2. Applies a hash function many times (100k iterations) to make brute-force slow. Uses a random salt to prevent rainbow table attacks.
- [ ] **What is a prepared statement?** — SQL query with `?` placeholders. Parameters are bound separately, preventing SQL injection.
- [ ] **What is lazy loading in React?** — `lazy()` + `Suspense` splits a component into a separate chunk downloaded only when needed.
- [ ] **What does `strokeDashoffset` do?** — Controls how much of an SVG stroke is visible. Used with `stroke-dasharray` to create progress circle animations.
- [ ] **What is the Hibernation API?** — Cloudflare's way to let Durable Objects sleep between WebSocket messages, reducing cost.
- [ ] **What is CORS and why is it needed?** — Browser security policy. APIs must explicitly allow cross-origin requests with `Access-Control-Allow-Origin` headers.

---

# Part 18 — Final Interview Readiness Report

## Interview Readiness Score: 88/100

| Category | Score | Notes |
|----------|-------|-------|
| Project understanding | 95/100 | You built it — you know it |
| React concepts | 85/100 | Strong on hooks, routing, state |
| Backend/Worker concepts | 85/100 | Hono, D1, routing all solid |
| AI/Vectorize concepts | 80/100 | Practice explaining embeddings simply |
| Security | 75/100 | Know the weaknesses and fixes |
| Performance | 80/100 | Lazy loading, WebSocket vs polling |
| Database design | 85/100 | Schema, FK, prepared statements |

---

## Biggest Strengths

1. **Full-stack depth** — You can speak to every layer from React state to Durable Object storage.
2. **Modern tech stack** — Cloudflare Workers, Durable Objects, Vectorize are cutting-edge. Interviewers will be impressed.
3. **Real AI integration** — Not fake — actual LLM scoring with robust response parsing.
4. **WebSocket real-time** — Many candidates have never built real-time systems.
5. **PDF client-side parsing** — Shows you think about privacy and performance.

---

## Biggest Weaknesses to Fix Before Tomorrow

1. **Auth system is incomplete** — Be upfront: "I built the full auth backend (PBKDF2, JWT, middleware) but haven't wired it to the frontend routes yet. It's my next sprint."
2. **No tests** — "I would add Vitest + Testing Library for components and Hono's test utilities for routes."
3. **CORS `*` in production** — Know the fix.
4. **No rate limiting** — Know the fix.
5. **Full resume stored in D1** — Know the optimization (R2 object storage).

---

## Questions You're Most Likely to Be Asked

1. Walk me through the complete user flow.
2. What is a Durable Object and why did you use it?
3. How does the AI scoring work?
4. Why browser-side PDF parsing?
5. How does the live leaderboard update in real-time?
6. What would you improve if you had more time?
7. What's the hardest bug you fixed?
8. Is this app secure? What would you change?

---

## Last-Minute Revision Checklist (15 minutes)

- [ ] Read `src/worker/index.ts` — the full routing setup
- [ ] Read `src/worker/routes/candidates.ts` — the 6-step AI pipeline
- [ ] Read `src/worker/leaderboard-do.ts` — DO state + WebSocket broadcast
- [ ] Read `Dashboard.tsx` lines 55–114 — WebSocket connection + auto-reconnect
- [ ] Know: What does `idFromName()` do?
- [ ] Know: What is `stroke-dashoffset`?
- [ ] Know: What is PBKDF2 and why 100k iterations?
- [ ] Know: Why `useRef` instead of `useState` for the WebSocket?
- [ ] Know: What does `not_found_handling = "single-page-application"` do?
- [ ] Know: What is an embedding?

---

## Cheat Sheet

```
PROJECT:      HireSight — AI resume screener
STACK:        React 19 + TypeScript + Hono + Cloudflare Workers
DATABASE:     D1 (SQLite) — jobs, candidates, users tables
AI:           bge-base-en-v1.5 (embeddings) + llama-3.1-8b (scoring)
VECTOR DB:    Vectorize (768-dim cosine similarity)
REALTIME:     Durable Objects + WebSocket (Hibernation API)
BUILD:        Vite + wrangler deploy
LIVE URL:     https://hiring-screener.shashishanthan2706.workers.dev

ROUTES:
  /                  → PostJob (create job, get apply link)
  /apply/:job_id     → ApplyJob (PDF upload, AI score)
  /dashboard/:job_id → Dashboard (live WebSocket leaderboard)

API ENDPOINTS:
  POST /api/jobs            → create job, embed JD
  GET  /api/jobs/:id        → fetch job title
  POST /api/candidates      → score resume, notify DO
  GET  /api/leaderboard/:id → REST snapshot
  WS   /api/leaderboard/:id/ws → live leaderboard

SCORING PIPELINE:
  1. Embed resume (bge-base-en-v1.5)
  2. Query Vectorize vs JD embedding → semantic score
  3. LLM prompt → JSON { score, reasoning }
  4. Store in D1
  5. Notify LeaderboardDO → broadcast WebSocket

SECURITY BUILT NOT WIRED:
  - PBKDF2 password hashing (100k iterations + salt)
  - JWT auth (HS256, 24h expiry)
  - Role-based middleware (requireHR, requireCandidate)
  - Prepared statements (SQL injection prevention)

KNOWN WEAKNESSES:
  - CORS origin: "*" (lock to domain in prod)
  - JWT in localStorage (use httpOnly cookies)
  - No rate limiting
  - Auth routes not mounted in index.ts
  - Full resume_text in D1 (use R2)
```

---

## One-Page Project Summary

**HireSight** is an AI-powered hiring tool I built on the Cloudflare developer platform.

**The problem:** Recruiters waste hours manually screening resumes. HireSight automates the first-pass screening using AI.

**How it works:** A recruiter posts a job (title + description). The system generates a shareable apply link. Candidates open the link, upload their PDF resume, and instantly receive an AI-generated match score (0–100) with reasoning. The recruiter watches all candidates rank themselves in real time on a live leaderboard — no page refresh needed.

**Tech stack:**
- **Frontend:** React 19 + TypeScript, served as a SPA from Cloudflare's CDN. Uses lazy loading for the PDF parser (pdfjs-dist, ~3MB).
- **Backend:** Hono framework running on Cloudflare Workers — serverless, global, zero cold starts.
- **Database:** Cloudflare D1 (SQLite) for job and candidate records.
- **AI:** Cloudflare Workers AI — `bge-base-en-v1.5` for 768-dim text embeddings, `llama-3.1-8b-instruct-fast` for 0–100 scoring with reasoning.
- **Vector search:** Cloudflare Vectorize — stores embeddings, enables semantic similarity between resumes and job descriptions.
- **Real-time:** Cloudflare Durable Objects with WebSocket Hibernation API — one DO instance per job acts as a WebSocket hub broadcasting leaderboard updates.

**What I'm most proud of:** The complete end-to-end architecture on a single platform. No external APIs, no separate servers. The PDF is parsed entirely in the browser (privacy-first). The leaderboard updates live via WebSocket with auto-reconnect and new-entry highlight animations.

**What I'd improve:** Wire in the already-built auth system, add rate limiting, use R2 for resume storage instead of D1, add pagination for large candidate sets, and replace `CORS origin: "*"` with a specific domain in production.

---

*Good luck tomorrow. You built this. You know it better than anyone in that room.*
