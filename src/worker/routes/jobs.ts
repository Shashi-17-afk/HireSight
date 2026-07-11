import { Hono } from "hono";
import { authenticate, requireHR } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";

const jobs = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

jobs.post("/", authenticate(), requireHR(), async (c) => {
  const body = await c.req.json<{ title: string; description: string }>();

  if (!body.title || !body.description) {
    return c.json({ error: "title and description are required" }, 400);
  }

  const jobId = crypto.randomUUID();

  // Store job in D1
  await c.env.DB.prepare(
    "INSERT INTO jobs (id, title, description) VALUES (?, ?, ?)"
  )
    .bind(jobId, body.title.trim(), body.description.trim())
    .run();

  // Embed the job description using Workers AI
  const embeddingResponse = await c.env.AI.run(
    "@cf/baai/bge-base-en-v1.5" as Parameters<typeof c.env.AI.run>[0],
    { text: [body.description.trim()] }
  );

  const embedding = (embeddingResponse as { data: number[][] }).data[0];

  // Store JD embedding in Vectorize with job_id as metadata
  await c.env.VECTORIZE.upsert([
    {
      id: `job_${jobId}`,
      values: embedding,
      metadata: { job_id: jobId, type: "job_description" },
    },
  ]);

  return c.json({ job_id: jobId, title: body.title.trim() }, 201);
});

// Fetch all jobs — used by the candidate jobs board
jobs.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, description, created_at,
      (SELECT COUNT(*) FROM candidates WHERE candidates.job_id = jobs.id) AS applicant_count
     FROM jobs
     ORDER BY created_at DESC`
  ).all<{ id: string; title: string; description: string; created_at: string; applicant_count: number }>();

  return c.json({ jobs: results ?? [] });
});

// Fetch a single job by ID (used by the candidate apply page)
jobs.get("/:id", async (c) => {
  const job = await c.env.DB.prepare("SELECT id, title, description FROM jobs WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ id: string; title: string; description: string }>();

  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

export default jobs;
