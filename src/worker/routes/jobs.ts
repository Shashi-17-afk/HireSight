import { Hono } from "hono";
import { authenticate, requireHR } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";
import { evaluateRateLimit } from "../lib/rate-limit";
import {
  JD_MODEL,
  buildJdMessages,
  buildRoleFacts,
  extractJsonRecord,
  normalizeJdInput,
  toJdDraft,
  type JdDraft,
  type JdInput,
} from "../lib/prompts/job-description";

const jobs = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

jobs.post("/", authenticate(), requireHR(), async (c) => {
  const body = await c.req.json<{ title: string; description: string }>();
  const user = c.get("user");

  if (!body.title || !body.description) {
    return c.json({ error: "title and description are required" }, 400);
  }

  const jobId = crypto.randomUUID();

  // Store job in D1 with HR recruiter user_id
  await c.env.DB.prepare(
    "INSERT INTO jobs (id, title, description, user_id) VALUES (?, ?, ?, ?)"
  )
    .bind(jobId, body.title.trim(), body.description.trim(), user.id)
    .run();

  // Embed the job description — non-fatal if AI/Vectorize unavailable.
  try {
    const embeddingResponse = await c.env.AI.run(
      "@cf/baai/bge-base-en-v1.5" as Parameters<typeof c.env.AI.run>[0],
      { text: [body.description.trim()] }
    );
    const embedding = (embeddingResponse as { data: number[][] }).data?.[0];
    if (embedding?.length) {
      await c.env.VECTORIZE.upsert([
        {
          id: `job_${jobId}`,
          values: embedding,
          metadata: { job_id: jobId, type: "job_description" },
        },
      ]);
    }
  } catch (err) {
    console.error("[jobs] embedding/vectorize failed for job", jobId, String(err));
  }

  return c.json({ job_id: jobId, title: body.title.trim() }, 201);
});

jobs.post("/generate-description", authenticate(), requireHR(), async (c) => {
  const user = c.get("user");
  const now = Math.floor(Date.now() / 1000);
  const rlKey = `jdgen:${user.id}`;

  try {
    const rawRl = await c.env.RATE_LIMIT.get(rlKey);
    const decision = evaluateRateLimit({ raw: rawRl, now, limit: 5, windowSecs: 60 });
    if (!decision.allowed) {
      return c.json(
        { error: "Too many generations. Please wait before trying again.", retryAfter: decision.retryAfter },
        429,
        { "Retry-After": String(decision.retryAfter) }
      );
    }
    if (decision.nextValue) {
      await c.env.RATE_LIMIT.put(rlKey, JSON.stringify(decision.nextValue), {
        expirationTtl: decision.ttlSeconds,
      });
    }
  } catch (rlErr) {
    console.error("[jobs] generate-description rate-limit KV error", String(rlErr));
  }

  let body: JdInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const input = normalizeJdInput(body);
  if (!input.title) {
    return c.json({ error: "Job title is required" }, 400);
  }

  const messages = buildJdMessages(buildRoleFacts(input));

  async function runOnce(): Promise<JdDraft | null> {
    try {
      const llmResponse = await c.env.AI.run(
        JD_MODEL as Parameters<typeof c.env.AI.run>[0],
        { messages, max_tokens: 1024 }
      );
      return toJdDraft(extractJsonRecord(llmResponse), input.title);
    } catch (err) {
      console.error("[jobs] generate-description model call failed", String(err));
      return null;
    }
  }

  const draft = (await runOnce()) ?? (await runOnce());
  if (!draft) {
    return c.json({ error: "AI did not return a usable job description. Try again." }, 502);
  }

  return c.json(draft);
});

// Fetch jobs — returns HR recruiter's own jobs if authenticated as HR, otherwise all open jobs for candidates
jobs.get("/", async (c) => {
  const authHeader = c.req.header("Authorization");
  let hrUserId: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { verify } = await import("hono/jwt");
      const token = authHeader.substring(7);
      const payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as { userId?: string; role?: string };
      if (payload.role?.toUpperCase() === "HR" && payload.userId) {
        hrUserId = payload.userId;
      }
    } catch {
      // Ignored if token invalid
    }
  }

  if (hrUserId) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, description, created_at, status,
        (SELECT COUNT(*) FROM candidates WHERE candidates.job_id = jobs.id) AS applicant_count
       FROM jobs
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(hrUserId).all<{ id: string; title: string; description: string; created_at: string; status: string; applicant_count: number }>();

    return c.json({ jobs: results ?? [] });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, description, created_at, status,
      (SELECT COUNT(*) FROM candidates WHERE candidates.job_id = jobs.id) AS applicant_count
     FROM jobs
     WHERE status = 'open'
     ORDER BY created_at DESC`
  ).all<{ id: string; title: string; description: string; created_at: string; status: string; applicant_count: number }>();

  return c.json({ jobs: results ?? [] });
});

// Fetch a single job by ID — used by the detail page and the apply form
jobs.get("/:id", async (c) => {
  const job = await c.env.DB.prepare(
    `SELECT id, title, description, created_at, status, user_id,
       (SELECT COUNT(*) FROM candidates WHERE candidates.job_id = jobs.id) AS applicant_count
     FROM jobs WHERE id = ?`
  )
    .bind(c.req.param("id"))
    .first<{ id: string; title: string; description: string; created_at: string; status: string; user_id: string | null; applicant_count: number }>();

  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

// Permanent delete a job and all associated candidate data (HR recruiter owner only)
jobs.delete("/:id", authenticate(), requireHR(), async (c) => {
  const jobId = c.req.param("id");
  const user = c.get("user");

  // 1. Fetch job to verify existence & ownership
  const job = await c.env.DB.prepare("SELECT id, title, user_id FROM jobs WHERE id = ?")
    .bind(jobId)
    .first<{ id: string; title: string; user_id: string | null }>();

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  if (job.user_id && job.user_id !== user.id) {
    return c.json({ error: "Forbidden: You can only delete jobs you created" }, 403);
  }

  // 2. Fetch all candidate IDs for Vectorize deletion prior to SQL delete
  const candidateRows = await c.env.DB.prepare("SELECT id FROM candidates WHERE job_id = ?")
    .bind(jobId)
    .all<{ id: string }>();
  const candidateIds = (candidateRows.results ?? []).map((r) => r.id);

  // 3. Execute D1 atomic transaction batch for cascade deletion
  try {
    await c.env.DB.batch([
      // a. Delete status logs for all applications tied to this job
      c.env.DB.prepare(
        "DELETE FROM application_status_log WHERE application_id IN (SELECT id FROM applications WHERE job_id = ?)"
      ).bind(jobId),

      // b. Delete applications tied to this job
      c.env.DB.prepare("DELETE FROM applications WHERE job_id = ?").bind(jobId),

      // c. Delete candidates (AI scoring rows) tied to this job
      c.env.DB.prepare("DELETE FROM candidates WHERE job_id = ?").bind(jobId),

      // d. Delete job record itself
      c.env.DB.prepare("DELETE FROM jobs WHERE id = ? AND user_id = ?").bind(jobId, user.id),
    ]);
  } catch (err) {
    console.error("[jobs] D1 cascade delete batch failed for job", jobId, String(err));
    return c.json({ error: "Failed to delete job and related records" }, 500);
  }

  // 4. Delete vector embeddings from Vectorize (best-effort, non-blocking failure)
  try {
    const vectorIds = [`job_${jobId}`, ...candidateIds.map((cId) => `candidate_${cId}`)];
    if (vectorIds.length > 0 && c.env.VECTORIZE) {
      await c.env.VECTORIZE.deleteByIds(vectorIds);
    }
  } catch (vecErr) {
    console.error("[jobs] Vectorize vector deletion failed for job", jobId, String(vecErr));
  }

  return c.json({ message: "Job permanently deleted successfully", job_id: jobId }, 200);
});

export default jobs;

