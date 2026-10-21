import { Hono } from 'hono';
import { authenticate, hrOwnsJob, requireHR } from '../lib/auth';
import type { AuthVariables } from '../lib/auth';
import { APPLICATION_STATUSES } from '../types/ats';
import type { ApplicationStatus } from '../types/ats';
import { sendEmail } from '../lib/email';
import { getStatusUpdateEmail, getOfferLetterEmail } from '../lib/email-templates';
import { generateOfferLetterPdf, uint8ArrayToBase64 } from '../lib/pdf-generator';
import { evaluateRateLimit } from '../lib/rate-limit';
import { scoreResumeWithLlm } from '../lib/scoring';
import { analyzeCandidateCv } from '../lib/cv-analysis';

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
	let job_id = c.req.query('job_id');

	// If job_id not provided in query param, resolve it directly from the candidate record
	if (!job_id) {
		const cand = await c.env.DB.prepare('SELECT job_id FROM candidates WHERE id = ?')
			.bind(submission_id).first<{ job_id: string }>();
		if (cand) job_id = cand.job_id;
	}

	if (!job_id) return c.json({ error: 'job_id could not be determined' }, 400);

	if (!(await hrOwnsJob(c.env.DB, job_id, c.get('user').id))) {
		return c.json({ error: 'Candidate not found or access denied' }, 404);
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
			cand.resume_text          AS resume_text,
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

	// No applications row → external link apply, enrich with profile if candidate registered by email
	const basic = await c.env.DB.prepare(`
		SELECT
			cand.id                   AS candidate_submission_id,
			cand.name                 AS candidate_name,
			cand.email                AS candidate_email,
			cand.score                AS ai_score,
			cand.reasoning            AS ai_reasoning,
			cand.resume_text          AS resume_text,
			cand.created_at           AS applied_at,
			cand.job_id,
			j.title                   AS job_title,
			u.id                      AS user_id,
			cp.phone,
			cp.headline,
			cp.linkedin_url,
			cp.github_url,
			cp.portfolio_url,
			cp.resume_url
		FROM candidates cand
		JOIN jobs j ON j.id = cand.job_id
		LEFT JOIN users u ON LOWER(u.email) = LOWER(cand.email)
		LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
		WHERE cand.id = ? AND cand.job_id = ?
	`).bind(submission_id, job_id).first<Record<string, unknown>>();

	if (!basic) return c.json({ error: 'Candidate not found' }, 404);

	// Ensure an applications row exists so HR can update status, send offers, and message them
	let appId: string | null = null;
	let appStatus = 'applied';
	const candidateUserId = (basic.user_id as string | null) ?? null;

	if (candidateUserId) {
		const existingApp = await c.env.DB.prepare(
			'SELECT id, status FROM applications WHERE user_id = ? AND job_id = ?'
		).bind(candidateUserId, job_id).first<{ id: string; status: string }>();

		if (existingApp) {
			appId = existingApp.id;
			appStatus = existingApp.status;
			await c.env.DB.prepare(
				'UPDATE applications SET candidate_submission_id = COALESCE(candidate_submission_id, ?) WHERE id = ?'
			).bind(submission_id, appId).run();
		}
	}

	if (!appId) {
		const newAppId = crypto.randomUUID();
		try {
			await c.env.DB.prepare(`
				INSERT INTO applications (id, user_id, job_id, candidate_submission_id, status, source, applied_at)
				VALUES (?, ?, ?, ?, 'applied', 'link', ?)
			`).bind(
				newAppId,
				candidateUserId,
				job_id,
				submission_id,
				(basic.applied_at as string) || new Date().toISOString()
			).run();
			appId = newAppId;
		} catch (err) {
			console.error('[applications] auto-create application record failed:', String(err));
		}
	}

	return c.json({
		...basic,
		application_id: appId,
		status: appStatus,
		isAnonymous: !basic.user_id,
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

// ── POST /api/applications/:submission_id/cv-analysis ────────────────────────
// Performs in-depth AI CV Analysis: Skills match/gap, Seniority rating, ATS scores,
// Standout strengths, Red flags, and Tailored interview questions.
applications.post('/:submission_id/cv-analysis', authenticate(), requireHR(), async (c) => {
	const submissionId = c.req.param('submission_id');
	const hr = c.get('user');

	const row = await c.env.DB.prepare(`
		SELECT cand.id, cand.job_id, cand.name, cand.resume_text, cand.score,
		       j.title AS job_title, j.description AS job_description, j.user_id AS job_owner_id
		FROM candidates cand
		JOIN jobs j ON j.id = cand.job_id
		WHERE cand.id = ?
	`).bind(submissionId).first<{
		id: string;
		job_id: string;
		name: string;
		resume_text: string;
		score: number;
		job_title: string;
		job_description: string;
		job_owner_id: string;
	}>();

	if (!row || row.job_owner_id !== hr.id) {
		return c.json({ error: 'Candidate not found or access denied' }, 404);
	}

	if (!row.resume_text || !row.resume_text.trim()) {
		return c.json({ error: 'No parsed resume text available for this candidate' }, 400);
	}

	const analysis = await analyzeCandidateCv(
		c.env.AI,
		row.job_title,
		row.job_description,
		row.resume_text
	);

	if (!analysis) {
		return c.json({ error: 'AI analysis model could not process resume. Please try again.' }, 502);
	}

	return c.json({
		success: true,
		candidateId: row.id,
		candidateName: row.name,
		jobTitle: row.job_title,
		resumeText: row.resume_text,
		analysis,
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

// ── POST /api/applications/:id/offer ─────────────────────────────────────────
// Issue an official formal offer of employment to candidate:
// 1. Validates HR ownership of application
// 2. Generates standard PDF Offer Letter bytes and base64
// 3. Dispatches transactional email with PDF attached
// 4. Sets application status to 'hired', logs to audit log, and notifies CandidateStatusDO
applications.post('/:id/offer', authenticate(), requireHR(), async (c) => {
	const applicationId = c.req.param('id');
	const hr = c.get('user');

	let body: {
		salary: string;
		startDate: string;
		employmentType?: string;
		workLocation?: string;
		reportingManager?: string;
		expiryDate?: string;
		benefitsSummary?: string;
		customNotes?: string;
		companyName?: string;
	};

	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	if (!body.salary?.trim() || !body.startDate?.trim()) {
		return c.json({ error: 'Salary and start date are required to extend an official offer' }, 400);
	}

	// Fetch application & verify ownership
	const app = await c.env.DB.prepare(`
		SELECT a.id, a.status, a.user_id, a.job_id, j.title AS job_title, j.user_id AS job_owner_id,
		       hr.name AS hr_name, hr.company_name AS hr_company,
		       COALESCE(u.name, cand.name) AS candidate_name,
		       COALESCE(u.email, cand.email) AS candidate_email
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		JOIN users hr ON hr.id = j.user_id
		LEFT JOIN candidates cand ON cand.id = a.candidate_submission_id
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.id = ?
	`).bind(applicationId)
	 .first<{
		id: string;
		status: string;
		user_id: string | null;
		job_id: string;
		job_title: string;
		job_owner_id: string | null;
		hr_name: string | null;
		hr_company: string | null;
		candidate_name: string | null;
		candidate_email: string | null;
	 }>();

	if (!app || app.job_owner_id !== hr.id) {
		return c.json({ error: 'Application not found' }, 404);
	}

	const candidateName = app.candidate_name || 'Candidate';
	const candidateEmail = app.candidate_email;
	const company = body.companyName?.trim() || app.hr_company || 'HireSight Technologies';
	const fromStatus = app.status;

	// 1. Generate PDF Offer Letter
	const pdfBytes = generateOfferLetterPdf({
		candidateName,
		candidateEmail: candidateEmail || '',
		companyName: company,
		jobTitle: app.job_title,
		salary: body.salary.trim(),
		startDate: body.startDate.trim(),
		employmentType: body.employmentType?.trim() || 'Full-Time',
		workLocation: body.workLocation?.trim() || 'Remote',
		reportingManager: body.reportingManager?.trim() || 'Department Lead',
		expiryDate: body.expiryDate?.trim(),
		benefitsSummary: body.benefitsSummary?.trim(),
		customNotes: body.customNotes?.trim(),
		recruiterName: app.hr_name || 'HireSight Talent Team',
	});
	const pdfBase64 = uint8ArrayToBase64(pdfBytes);
	const pdfFilename = `Offer_Letter_${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

	// 2. Update Application row to 'hired'
	await c.env.DB.prepare(`
		UPDATE applications
		SET status = 'hired', changed_by_hr_id = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`).bind(hr.id, applicationId).run();

	// 3. Insert audit log entry
	const auditNote = `Official Offer Letter Issued: ${body.salary.trim()} · Start Date: ${body.startDate.trim()}`;
	await c.env.DB.prepare(`
		INSERT INTO application_status_log
			(id, application_id, from_status, to_status, changed_by_hr_id, note)
		VALUES (?, ?, ?, ?, ?, ?)
	`).bind(
		crypto.randomUUID(),
		applicationId,
		fromStatus,
		'hired',
		hr.id,
		auditNote
	).run();

	// 4. Real-time push via CandidateStatusDO (if authenticated applicant)
	if (app.user_id) {
		try {
			const doId = c.env.CANDIDATE_STATUS.idFromName(app.user_id);
			const stub = c.env.CANDIDATE_STATUS.get(doId);
			await stub.fetch(new Request('https://do-internal/notify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					application_id: applicationId,
					job_id: app.job_id,
					job_title: app.job_title,
					from_status: fromStatus,
					to_status: 'hired',
				}),
			}));
		} catch (doErr) {
			console.error('[applications] candidate status DO notification failed:', String(doErr));
		}
	}

	// 5. Send Email with PDF Attachment
	let emailSent = false;
	if (candidateEmail) {
		try {
			const offerEmail = getOfferLetterEmail({
				candidateName,
				jobTitle: app.job_title,
				companyName: company,
				salary: body.salary.trim(),
				startDate: body.startDate.trim(),
				employmentType: body.employmentType?.trim(),
				workLocation: body.workLocation?.trim(),
				reportingManager: body.reportingManager?.trim(),
				expiryDate: body.expiryDate?.trim(),
				benefitsSummary: body.benefitsSummary?.trim(),
				customNotes: body.customNotes?.trim(),
				dashboardUrl: 'https://hiresight.shashishanthan2706.workers.dev/candidate/dashboard',
			});

			const sendRes = await sendEmail(c.env, {
				to: candidateEmail,
				subject: offerEmail.subject,
				html: offerEmail.html,
				attachments: [
					{
						name: pdfFilename,
						content: pdfBase64,
					},
				],
			});
			emailSent = sendRes.success;
		} catch (emailErr) {
			console.error('[applications] offer email dispatch error:', String(emailErr));
		}
	}

	return c.json({
		success: true,
		status: 'hired',
		candidateName,
		candidateEmail,
		emailSent,
		pdfFilename,
		pdfBase64,
		message: emailSent
			? `Offer Letter PDF sent successfully to ${candidateEmail}!`
			: `Offer recorded. (Email could not be delivered to ${candidateEmail || 'unregistered email'})`,
	});
});

// ── POST /api/applications/:id/offer/preview ──────────────────────────────────
// Generates and returns the PDF offer letter without modifying state or sending email.
applications.post('/:id/offer/preview', authenticate(), requireHR(), async (c) => {
	const applicationId = c.req.param('id');
	const hr = c.get('user');

	let body: {
		salary?: string;
		startDate?: string;
		employmentType?: string;
		workLocation?: string;
		reportingManager?: string;
		expiryDate?: string;
		benefitsSummary?: string;
		customNotes?: string;
		companyName?: string;
	};

	try {
		body = await c.req.json();
	} catch {
		body = {};
	}

	const app = await c.env.DB.prepare(`
		SELECT a.id, a.status, a.user_id, a.job_id, j.title AS job_title, j.user_id AS job_owner_id,
		       hr.name AS hr_name, hr.company_name AS hr_company,
		       COALESCE(u.name, cand.name) AS candidate_name,
		       COALESCE(u.email, cand.email) AS candidate_email
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		JOIN users hr ON hr.id = j.user_id
		LEFT JOIN candidates cand ON cand.id = a.candidate_submission_id
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.id = ?
	`).bind(applicationId)
	 .first<{
		id: string;
		status: string;
		user_id: string | null;
		job_id: string;
		job_title: string;
		job_owner_id: string | null;
		hr_name: string | null;
		hr_company: string | null;
		candidate_name: string | null;
		candidate_email: string | null;
	 }>();

	if (!app || app.job_owner_id !== hr.id) {
		return c.json({ error: 'Application not found' }, 404);
	}

	const candidateName = app.candidate_name || 'Candidate';
	const company = body.companyName?.trim() || app.hr_company || 'HireSight Technologies';

	const pdfBytes = generateOfferLetterPdf({
		candidateName,
		candidateEmail: app.candidate_email || '',
		companyName: company,
		jobTitle: app.job_title,
		salary: body.salary?.trim() || 'Competitive',
		startDate: body.startDate?.trim() || 'To be mutually determined',
		employmentType: body.employmentType?.trim() || 'Full-Time',
		workLocation: body.workLocation?.trim() || 'Remote',
		reportingManager: body.reportingManager?.trim() || 'Department Lead',
		expiryDate: body.expiryDate?.trim(),
		benefitsSummary: body.benefitsSummary?.trim(),
		customNotes: body.customNotes?.trim(),
		recruiterName: app.hr_name || 'HireSight Talent Team',
	});

	const pdfBase64 = uint8ArrayToBase64(pdfBytes);
	const pdfFilename = `Offer_Letter_${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

	return c.json({
		pdfFilename,
		pdfBase64,
	});
});

export default applications;

