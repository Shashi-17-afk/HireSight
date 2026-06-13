import { Hono } from "hono";

const jobs = new Hono<{ Bindings: Env }>();

jobs.post("/", async (c) => {
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

export default jobs;
