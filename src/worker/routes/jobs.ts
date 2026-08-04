import { Hono } from "hono";
import { authenticate, requireHR } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";

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
    `SELECT id, title, description, created_at, status,
       (SELECT COUNT(*) FROM candidates WHERE candidates.job_id = jobs.id) AS applicant_count
     FROM jobs WHERE id = ?`
  )
    .bind(c.req.param("id"))
    .first<{ id: string; title: string; description: string; created_at: string; status: string; applicant_count: number }>();

  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

export default jobs;
