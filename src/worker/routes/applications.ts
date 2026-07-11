import { Hono } from 'hono';
import { authenticate, requireHR } from '../lib/auth';
import type { AuthVariables } from '../lib/auth';
import { APPLICATION_STATUSES } from '../types/ats';
import type { ApplicationStatus } from '../types/ats';

const applications = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

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
		SELECT a.status, a.user_id, a.job_id, j.title AS job_title
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		WHERE a.id = ?
	`).bind(applicationId)
	 .first<{ status: string; user_id: string | null; job_id: string; job_title: string }>();

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

	return c.json({ status: newStatus, changed: true });
});

export default applications;
