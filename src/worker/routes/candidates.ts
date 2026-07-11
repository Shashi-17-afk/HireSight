import { Hono } from "hono";
import { verify } from "hono/jwt";
import { authenticate, requireCandidate } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";

const candidates = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Authenticated candidate: view their own past applications
candidates.get("/my-applications", authenticate(), requireCandidate(), async (c) => {
	const user = c.get("user");

	const userDetails = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?")
		.bind(user.id)
		.first<{ email: string }>();

	if (!userDetails) return c.json({ error: "User not found" }, 404);

	const result = await c.env.DB.prepare(
		`SELECT c.id, c.score, c.reasoning, c.created_at,
		        j.title AS job_title, j.id AS job_id
		 FROM candidates c
		 JOIN jobs j ON c.job_id = j.id
		 WHERE c.email = ?
		 ORDER BY c.created_at DESC`
	)
		.bind(userDetails.email)
		.all<{ id: string; score: number; reasoning: string; created_at: string; job_title: string; job_id: string }>();

	return c.json(result.results);
});

candidates.post("/", async (c) => {
	// Server-side profile-completeness backstop for authenticated candidates.
	// If a Bearer token is present and belongs to a candidate, we verify
	// candidate_profiles.is_complete before proceeding.
	// No token → anonymous external link apply → skip entirely (untouched flow).
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.substring(7);
		const jwtSecret = c.env.JWT_SECRET;
		if (jwtSecret) {
			try {
				const payload = await verify(token, jwtSecret, "HS256");
				if (typeof payload.userId === "string" && payload.role === "candidate") {
					const prof = await c.env.DB.prepare(
						"SELECT is_complete FROM candidate_profiles WHERE user_id = ?"
					).bind(payload.userId).first<{ is_complete: number }>();
					if (!prof || prof.is_complete === 0) {
						return c.json({
							error: "Complete your profile before applying.",
							code: "PROFILE_INCOMPLETE",
						}, 400);
					}
				}
			} catch {
				// Invalid / expired token — treat as anonymous and proceed.
			}
		}
	}

  const body = await c.req.json<{
    job_id: string;
    name: string;
    email: string;
    resume_text: string;
  }>();

  if (!body.job_id || !body.name || !body.email || !body.resume_text) {
    return c.json({ error: "job_id, name, email, and resume_text are required" }, 400);
  }

  // Fetch the job from D1
  const job = await c.env.DB.prepare("SELECT * FROM jobs WHERE id = ?")
    .bind(body.job_id)
    .first<{ id: string; title: string; description: string }>();

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  const candidateId = crypto.randomUUID();

  // Step 4a: Embed the resume
  const resumeEmbedResponse = (await c.env.AI.run(
    "@cf/baai/bge-base-en-v1.5" as Parameters<typeof c.env.AI.run>[0],
    { text: [body.resume_text] }
  )) as { data: number[][] };
  const resumeEmbedding = resumeEmbedResponse.data[0];

  // Step 4b: Semantic similarity via Vectorize (best-effort, non-blocking)
  let semanticScore = 0;
  try {
    const vectorQuery = await c.env.VECTORIZE.query(resumeEmbedding, {
      topK: 1,
      filter: { job_id: body.job_id },
      returnMetadata: "all",
    });
    if (vectorQuery.matches.length > 0) {
      semanticScore = Math.round(vectorQuery.matches[0].score * 100);
    }
  } catch {
    // Vectorize unavailable locally — skip, LLM score takes over
  }

  // Store resume embedding in Vectorize for future candidate comparisons
  try {
    await c.env.VECTORIZE.upsert([
      {
        id: `candidate_${candidateId}`,
        values: resumeEmbedding,
        metadata: { job_id: body.job_id, type: "resume", candidate_id: candidateId },
      },
    ]);
  } catch {
    // Non-fatal
  }

  // Step 4c: LLM scoring — primary score source
  let score = semanticScore;
  let reasoning = `Semantic similarity score: ${semanticScore}/100`;

  try {
    const prompt = `You are a hiring assistant. Given this Job Description and Resume, score the candidate from 0-100 and give 2 line reasoning.
Return ONLY valid JSON with no extra text: { "score": number, "reasoning": string }

JD: ${job.description}
Resume: ${body.resume_text}`;

    const llmResponse = await c.env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast" as Parameters<typeof c.env.AI.run>[0],
      {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 256,
      }
    );

    const resp = llmResponse as Record<string, unknown>;

    // The -fast model returns OpenAI-style: { response: { score, reasoning }, choices: [...] }
    // Older models return: { response: "string" }
    // Try the pre-parsed object first, then fall back to text extraction
    let parsed: { score?: unknown; reasoning?: unknown } | null = null;

    if (resp.response && typeof resp.response === "object") {
      // Already parsed by the model runtime
      parsed = resp.response as { score?: unknown; reasoning?: unknown };
    } else {
      // Text response — extract JSON manually
      let rawText = "";
      if (typeof resp.response === "string") rawText = resp.response;
      else if (typeof resp.content === "string") rawText = resp.content as string;
      else rawText = JSON.stringify(resp);

      const cleaned = rawText.replace(/```(?:json)?/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as { score?: unknown; reasoning?: unknown };
      }
    }

    if (parsed) {
      if (typeof parsed.score === "number" && parsed.score >= 0 && parsed.score <= 100) {
        score = Math.round(parsed.score);
      }
      if (typeof parsed.reasoning === "string" && parsed.reasoning.trim()) {
        reasoning = parsed.reasoning.trim();
      }
    }
  } catch (llmErr) {
    reasoning = `LLM error: ${String(llmErr)}`;
  }

  // Step 4e: Store in D1
  await c.env.DB.prepare(
    `INSERT INTO candidates (id, job_id, name, email, resume_text, score, reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      candidateId,
      body.job_id,
      body.name.trim(),
      body.email.trim(),
      body.resume_text.trim(),
      score,
      reasoning
    )
    .run();

  // Step 4f: Notify Durable Object leaderboard
  try {
    const doId = c.env.LEADERBOARD.idFromName(body.job_id);
    const stub = c.env.LEADERBOARD.get(doId);
    await stub.fetch(
      new Request("https://do-internal/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: candidateId,
          name: body.name.trim(),
          score,
          reasoning,
          submittedAt: Date.now(),
        }),
      })
    );
  } catch {
    // Non-fatal — leaderboard will sync on next WebSocket connect
  }

  return c.json({ candidate_id: candidateId, score, reasoning }, 201);
});

export default candidates;
