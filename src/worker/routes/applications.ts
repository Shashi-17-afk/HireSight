import { Hono } from 'hono';
import { authenticate, hrOwnsJob, requireHR } from '../lib/auth';
import type { AuthVariables } from '../lib/auth';
import { APPLICATION_STATUSES } from '../types/ats';
import type { ApplicationStatus } from '../types/ats';
import { sendEmail } from '../lib/email';
import { getStatusUpdateEmail } from '../lib/email-templates';
import { evaluateRateLimit } from '../lib/rate-limit';
import { scoreResumeWithLlm } from '../lib/scoring';

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
	if (!(await hrOwnsJob(c.env.DB, job_id, c.get('user').id))) {
		return c.json({ error: 'Job not found' }, 404);
	}

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
	if (!(await hrOwnsJob(c.env.DB, job_id, c.get('user').id))) {
		return c.json({ error: 'Candidate not found' }, 404);
	}

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

// ── POST /api/applications/:submission_id/rescore  ───────────────────────────
// Re-scores the stored resume text against the job's current description.
// The previous score is kept if the model fails or returns no valid score.
applications.post('/:submission_id/rescore', authenticate(), requireHR(), async (c) => {
	const submissionId = c.req.param('submission_id');
	const hr = c.get('user');

	const now = Math.floor(Date.now() / 1000);
	const rlKey = `rescore:${hr.id}`;
	try {
		const rawRl = await c.env.RATE_LIMIT.get(rlKey);
		const decision = evaluateRateLimit({ raw: rawRl, now, limit: 10, windowSecs: 60 });
		if (!decision.allowed) {
			return c.json(
				{ error: 'Too many re-runs. Please wait a moment.', retryAfter: decision.retryAfter },
				429,
				{ 'Retry-After': String(decision.retryAfter) }
			);
		}
		if (decision.nextValue) {
			await c.env.RATE_LIMIT.put(rlKey, JSON.stringify(decision.nextValue), {
				expirationTtl: decision.ttlSeconds,
			});
		}
	} catch (rlErr) {
		console.error('[applications] rescore rate-limit KV error', String(rlErr));
	}

	const row = await c.env.DB.prepare(`
		SELECT cand.id, cand.job_id, cand.name, cand.resume_text, cand.score AS previous_score,
		       j.description, j.user_id AS job_owner_id
		FROM candidates cand
		JOIN jobs j ON j.id = cand.job_id
		WHERE cand.id = ?
	`).bind(submissionId).first<{
		id: string;
		job_id: string;
		name: string;
		resume_text: string | null;
		previous_score: number | null;
		description: string;
		job_owner_id: string | null;
	}>();

	if (!row || row.job_owner_id !== hr.id) {
		return c.json({ error: 'Candidate not found' }, 404);
	}
	if (!row.resume_text?.trim()) {
		return c.json({ error: 'No resume text is stored for this candidate, so it cannot be re-scored.' }, 422);
	}

	let result;
	try {
		result = await scoreResumeWithLlm(c.env.AI, row.description, row.resume_text);
	} catch (err) {
		console.error('[applications] rescore model failed', String(err));
		return c.json({ error: 'Workers AI is unavailable right now. The previous score was kept.' }, 502);
	}
	if (!result) {
		return c.json({ error: 'The model did not return a valid score. The previous score was kept.' }, 502);
	}

	await c.env.DB.prepare('UPDATE candidates SET score = ?, reasoning = ? WHERE id = ?')
		.bind(result.score, result.reasoning, row.id)
		.run();

	try {
		const stub = c.env.LEADERBOARD.get(c.env.LEADERBOARD.idFromName(row.job_id));
		await stub.fetch(new Request('https://do-internal/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: row.id,
				name: row.name,
				score: result.score,
				reasoning: result.reasoning,
				submittedAt: Date.now(),
			}),
		}));
	} catch {
		// Non-fatal — D1 already holds the new score
	}

	return c.json({
		score: result.score,
		reasoning: result.reasoning,
		previous_score: row.previous_score,
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
		SELECT a.status, a.user_id, a.job_id, j.title AS job_title, j.user_id AS job_owner_id,
		       COALESCE(u.name, cand.name) AS candidate_name,
		       COALESCE(u.email, cand.email) AS candidate_email
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		LEFT JOIN candidates cand ON cand.id = a.candidate_submission_id
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.id = ?
	`).bind(applicationId)
	 .first<{ status: string; user_id: string | null; job_id: string; job_title: string; job_owner_id: string | null; candidate_name: string | null; candidate_email: string | null }>();

	if (!app || app.job_owner_id !== hr.id) return c.json({ error: 'Application not found' }, 404);

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

export default applications;
