import { Hono } from "hono";
import { authenticate, requireHR } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";

const jobs = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Fetch jobs created by the authenticated HR user
jobs.get("/", authenticate(), requireHR(), async (c) => {
  const user = c.get("user");
  const result = await c.env.DB.prepare(
    "SELECT id, title, description, created_at FROM jobs WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(user.id)
    .all();
  return c.json(result.results);
});

// Create a new job posting (HR only)
jobs.post("/", authenticate(), requireHR(), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ title: string; description: string }>();

  if (!body.title || !body.description) {
    return c.json({ error: "title and description are required" }, 400);
  }

  const jobId = crypto.randomUUID();

  // Store job in D1
  await c.env.DB.prepare(
    "INSERT INTO jobs (id, title, description, user_id) VALUES (?, ?, ?, ?)"
  )
    .bind(jobId, body.title.trim(), body.description.trim(), user.id)
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

// Fetch a single job by ID (used by the candidate apply page)
jobs.get("/:id", async (c) => {
  const job = await c.env.DB.prepare("SELECT id, title, description FROM jobs WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ id: string; title: string; description: string }>();

  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

export default jobs;

