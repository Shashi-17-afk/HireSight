import { Hono } from 'hono';
import { authenticate, requireHR } from '../lib/auth';
import type { AuthVariables } from '../lib/auth';
import { APPLICATION_STATUSES } from '../types/ats';
import type { ApplicationStatus } from '../types/ats';
import { sendEmail } from '../lib/email';
import { getStatusUpdateEmail } from '../lib/email-templates';

const applications = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ── GET /api/applications/hired ────────────────────────────────────────────────
// List all hired or offered candidates across all jobs for the HR recruiter roster.
applications.get('/hired', authenticate(), requireHR(), async (c) => {
	const hrUser = c.get('user');
	const { results } = await c.env.DB.prepare(`
		SELECT
			a.id                      AS application_id,
			a.user_id,
			a.status,
			a.updated_at              AS hired_at,
			a.job_id,
			j.title                   AS job_title,
			cand.id                   AS candidate_submission_id,
			cand.name                 AS candidate_name,
			cand.email                AS candidate_email,
			cand.score                AS ai_score,
			cand.reasoning            AS ai_reasoning,
			cp.phone,
			cp.headline,
			cp.linkedin_url,
			cp.github_url
		FROM applications a
		JOIN candidates cand ON cand.id = a.candidate_submission_id
		JOIN jobs j          ON j.id    = a.job_id
		LEFT JOIN candidate_profiles cp ON cp.user_id = a.user_id
		WHERE j.user_id = ? AND a.status IN ('hired', 'offered')
		ORDER BY a.updated_at DESC
	`).bind(hrUser.id).all();

	return c.json({ hired: results ?? [] });
});

// ── GET /api/applications/all ────────────────────────────────────────────────
// Every candidate across this recruiter's jobs (includes link applies).
applications.get('/all', authenticate(), requireHR(), async (c) => {
	const hrUser = c.get('user');
	const { results } = await c.env.DB.prepare(`
		SELECT
			cand.id                   AS candidate_submission_id,
			cand.name                 AS candidate_name,
			cand.email                AS candidate_email,
			cand.score                AS ai_score,
			cand.reasoning            AS ai_reasoning,
			cand.created_at           AS submitted_at,
			cand.job_id,
			j.title                   AS job_title,
			j.status                  AS job_status,
			a.id                      AS application_id,
			a.user_id,
			a.status,
			a.source,
			a.applied_at,
			a.updated_at,
			cp.phone,
			cp.headline,
			cp.skills,
			cp.linkedin_url,
			cp.github_url,
			cp.portfolio_url,
			cp.resume_url
		FROM candidates cand
		JOIN jobs j ON j.id = cand.job_id
		LEFT JOIN applications a ON a.candidate_submission_id = cand.id
		LEFT JOIN candidate_profiles cp ON cp.user_id = a.user_id
		WHERE j.user_id = ?
		ORDER BY cand.created_at DESC
	`).bind(hrUser.id).all();

	return c.json({ candidates: results ?? [] });
});

// ── GET /api/applications?job_id=  ───────────────────────────────────────────
// List all applications for a job, enriched with profile + AI data.
// Used by CandidateDetail to populate the leaderboard "View →" panel.
applications.get('/', authenticate(), requireHR(), async (c) => {
	const job_id = c.req.query('job_id');
	if (!job_id) return c.json({ error: 'job_id query param required' }, 400);

	const { results } = await c.env.DB.prepare(`
		SELECT
			a.id                      AS application_id,
			a.user_id,
			a.status,
			a.applied_at,
			a.candidate_submission_id,
			cand.name                 AS candidate_name,
			cand.email                AS candidate_email,
			cand.score                AS ai_score,
			cand.reasoning            AS ai_reasoning,
			cp.phone,
			cp.headline,
			cp.linkedin_url,
			cp.github_url,
			cp.portfolio_url,
			cp.resume_url
		FROM applications a
		JOIN  candidates cand ON cand.id = a.candidate_submission_id
		LEFT JOIN candidate_profiles cp   ON cp.user_id  = a.user_id
		WHERE a.job_id = ?
		ORDER BY cand.score DESC, a.applied_at ASC
	`).bind(job_id).all();

	return c.json({ applications: results ?? [] });
});

// ── GET /api/applications/:submission_id?job_id=  ────────────────────────────
// Single candidate detail — keyed by candidates.id (the AI scoring record).
// Falls back to basic info if no applications row exists (external link apply).
applications.get('/:submission_id', authenticate(), requireHR(), async (c) => {
	const submission_id = c.req.param('submission_id');
	const job_id = c.req.query('job_id');
	if (!job_id) return c.json({ error: 'job_id query param required' }, 400);

	const row = await c.env.DB.prepare(`
		SELECT
			a.id                      AS application_id,
			a.user_id,
			a.status,
			a.applied_at,
			a.candidate_submission_id,
			a.job_id,
			j.title                   AS job_title,
			cand.name                 AS candidate_name,
			cand.email                AS candidate_email,
			cand.score                AS ai_score,
			cand.reasoning            AS ai_reasoning,
			cp.phone,
			cp.headline,
			cp.linkedin_url,
			cp.github_url,
			cp.portfolio_url,
			cp.resume_url
		FROM applications a
		JOIN  candidates cand ON cand.id = a.candidate_submission_id
		JOIN  jobs j          ON j.id    = a.job_id
		LEFT JOIN candidate_profiles cp   ON cp.user_id  = a.user_id
		WHERE a.candidate_submission_id = ? AND a.job_id = ?
	`).bind(submission_id, job_id).first<Record<string, unknown>>();

	if (row) return c.json({ ...row, isAnonymous: false });

	// No applications row → external link apply, show basic scoring info only.
	const basic = await c.env.DB.prepare(`
		SELECT id, name, email, score, reasoning, created_at AS applied_at, job_id
		FROM candidates
		WHERE id = ? AND job_id = ?
	`).bind(submission_id, job_id).first<Record<string, unknown>>();

	if (!basic) return c.json({ error: 'Candidate not found' }, 404);

	const job = await c.env.DB.prepare('SELECT title FROM jobs WHERE id = ?')
		.bind(job_id).first<{ title: string }>();

	return c.json({
		...basic,
		job_title: job?.title ?? '',
		application_id: null,
		status: null,
		isAnonymous: true,
	});
});

// ── PATCH /api/applications/:id/status  ──────────────────────────────────────
// HR moves a candidate through the pipeline.
// Writes to applications + application_status_log, then pushes a real-time
// notification to the candidate via CandidateStatusDO.
applications.patch('/:id/status', authenticate(), requireHR(), async (c) => {
	const applicationId = c.req.param('id');
	const hr = c.get('user');

	let body: { status: string; note?: string };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	if (!APPLICATION_STATUSES.includes(body.status as ApplicationStatus)) {
		return c.json({
			error: `Invalid status. Allowed: ${APPLICATION_STATUSES.join(', ')}`,
		}, 400);
	}

	const newStatus = body.status as ApplicationStatus;

	const app = await c.env.DB.prepare(`
		SELECT a.status, a.user_id, a.job_id, j.title AS job_title,
		       COALESCE(u.name, cand.name) AS candidate_name,
		       COALESCE(u.email, cand.email) AS candidate_email
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		LEFT JOIN candidates cand ON cand.id = a.candidate_submission_id
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.id = ?
	`).bind(applicationId)
	 .first<{ status: string; user_id: string | null; job_id: string; job_title: string; candidate_name: string | null; candidate_email: string | null }>();

	if (!app) return c.json({ error: 'Application not found' }, 404);

	// No-op if status unchanged
	if (app.status === newStatus) return c.json({ status: newStatus, changed: false });

	const fromStatus = app.status;

	// Update application row
	await c.env.DB.prepare(`
		UPDATE applications
		SET status = ?, changed_by_hr_id = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`).bind(newStatus, hr.id, applicationId).run();

	// Audit log entry
	await c.env.DB.prepare(`
		INSERT INTO application_status_log
			(id, application_id, from_status, to_status, changed_by_hr_id, note)
		VALUES (?, ?, ?, ?, ?, ?)
	`).bind(
		crypto.randomUUID(),
		applicationId,
		fromStatus,
		newStatus,
		hr.id,
		body.note ?? null,
	).run();

	// Real-time push to candidate (authenticated applies only).
	// Failure is non-fatal — candidate will see the update on next page visit.
	if (app.user_id) {
		try {
			const doId = c.env.CANDIDATE_STATUS.idFromName(app.user_id);
			const stub = c.env.CANDIDATE_STATUS.get(doId);
			await stub.fetch(new Request('https://do-internal/notify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					application_id: applicationId,
					job_id:         app.job_id,
					job_title:      app.job_title,
					from_status:    fromStatus,
					to_status:      newStatus,
				}),
			}));
		} catch {
			// Non-fatal
		}
	}

	// Trigger Status Change Email to candidate
	if (app.candidate_email) {
		try {
			const statusTpl = getStatusUpdateEmail({
				candidateName: app.candidate_name ?? 'Applicant',
				jobTitle: app.job_title,
				newStatus,
				note: body.note,
				dashboardUrl: 'https://hiresight.shashishanthan2706.workers.dev/candidate/dashboard',
			});
			await sendEmail(c.env, {
				to: app.candidate_email,
				subject: statusTpl.subject,
				html: statusTpl.html,
			});
		} catch (emailErr) {
			console.error('[applications] status email dispatch error:', String(emailErr));
		}
	}

	return c.json({ status: newStatus, changed: true });
});

// ── POST /api/applications/:submission_id/rescreen?job_id=  ────────────────────
// HR re-evaluates candidate resume text against the current job description.
applications.post('/:submission_id/rescreen', authenticate(), requireHR(), async (c) => {
	const submission_id = c.req.param('submission_id');
	const job_id = c.req.query('job_id');
	if (!job_id) return c.json({ error: 'job_id query param required' }, 400);

	const candidate = await c.env.DB.prepare(`
		SELECT c.id, c.name, c.email, c.resume_text, c.job_id
		FROM candidates c
		WHERE c.id = ? AND c.job_id = ?
	`).bind(submission_id, job_id).first<{ id: string; name: string; email: string; resume_text: string; job_id: string }>();

	if (!candidate) return c.json({ error: 'Candidate submission not found' }, 404);

	const job = await c.env.DB.prepare(`
		SELECT id, title, description FROM jobs WHERE id = ?
	`).bind(job_id).first<{ id: string; title: string; description: string }>();

	if (!job) return c.json({ error: 'Job not found' }, 404);

	// Step 1: Embed resume — non-fatal if AI is unavailable
	let resumeEmbedding: number[] | null = null;
	try {
		const resumeEmbedResponse = (await c.env.AI.run(
			'@cf/baai/bge-base-en-v1.5' as Parameters<typeof c.env.AI.run>[0],
			{ text: [candidate.resume_text] }
		)) as { data: number[][] };
		resumeEmbedding = resumeEmbedResponse.data?.[0] ?? null;
	} catch (err) {
		console.error('[applications] rescreen resume embedding failed', String(err));
	}

	// Step 2: Semantic similarity via Vectorize
	let semanticScore = 0;
	if (resumeEmbedding) {
		try {
			const vectorQuery = await c.env.VECTORIZE.query(resumeEmbedding, {
				topK: 1,
				filter: { job_id },
				returnMetadata: 'all',
			});
			if (vectorQuery.matches.length > 0) {
				semanticScore = Math.round(vectorQuery.matches[0].score * 100);
			}
		} catch {
			// Skip vector similarity if unavailable
		}

		try {
			await c.env.VECTORIZE.upsert([
				{
					id: `candidate_${candidate.id}`,
					values: resumeEmbedding,
					metadata: { job_id, type: 'resume', candidate_id: candidate.id },
				},
			]);
		} catch {
			// Non-fatal
		}
	}

	// Step 3: LLM scoring
	let score = semanticScore;
	let reasoning = `Semantic similarity score: ${semanticScore}/100`;

	try {
		const prompt = `You are a hiring assistant. Given this Job Description and Resume, score the candidate from 0-100 and give 2 line reasoning.
Return ONLY valid JSON with no extra text: { "score": number, "reasoning": string }

JD: ${job.description}
Resume: ${candidate.resume_text}`;

		const llmResponse = await c.env.AI.run(
			'@cf/meta/llama-3.1-8b-instruct-fast' as Parameters<typeof c.env.AI.run>[0],
			{
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 256,
			}
		);

		const resp = llmResponse as Record<string, unknown>;
		let parsed: { score?: unknown; reasoning?: unknown } | null = null;

		if (resp.response && typeof resp.response === 'object') {
			parsed = resp.response as { score?: unknown; reasoning?: unknown };
		} else {
			let rawText = '';
			if (typeof resp.response === 'string') rawText = resp.response;
			else if (typeof resp.content === 'string') rawText = resp.content as string;
			else rawText = JSON.stringify(resp);

			const cleaned = rawText.replace(/```(?:json)?/gi, '').trim();
			const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				parsed = JSON.parse(jsonMatch[0]) as { score?: unknown; reasoning?: unknown };
			}
		}

		if (parsed) {
			if (typeof parsed.score === 'number' && parsed.score >= 0 && parsed.score <= 100) {
				score = Math.round(parsed.score);
			}
			if (typeof parsed.reasoning === 'string' && parsed.reasoning.trim()) {
				reasoning = parsed.reasoning.trim();
			}
		}
	} catch (llmErr) {
		reasoning = `LLM error: ${String(llmErr)}`;
	}

	// Step 4: Update candidates table in D1
	await c.env.DB.prepare(`
		UPDATE candidates
		SET score = ?, reasoning = ?
		WHERE id = ?
	`).bind(score, reasoning, candidate.id).run();

	// Step 5: Notify Durable Object Leaderboard
	try {
		const doId = c.env.LEADERBOARD.idFromName(job_id);
		const stub = c.env.LEADERBOARD.get(doId);
		await stub.fetch(
			new Request('https://do-internal/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: candidate.id,
					name: candidate.name,
					score,
					reasoning,
					submittedAt: Date.now(),
				}),
			})
		);
	} catch {
		// Non-fatal
	}

	return c.json({ success: true, score, reasoning });
});

export default applications;
