import { Hono } from "hono";
import { authenticate, requireCandidate, requireHR } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";
import { sendEmail } from "../lib/email";
import { getInterviewScheduledEmail } from "../lib/email-templates";

type AppEnv = { Bindings: Env; Variables: AuthVariables };

const interviews = new Hono<AppEnv>();

// ── POST /api/interviews — Schedule a new interview round ────────────────────
interviews.post("/", authenticate(), requireHR(), async (c) => {
	const hr = c.get("user");
	const body = await c.req.json<{
		application_id: string;
		job_id?: string;
		round_type?: string;
		scheduled_at: string;
		duration_minutes?: number;
		meeting_link?: string;
		notes?: string;
		candidate_email?: string;
		candidate_name?: string;
	}>();

	if (!body.application_id || !body.scheduled_at) {
		return c.json({ error: "application_id and scheduled_at are required" }, 400);
	}

	// 1. Fetch application details & verify HR ownership (by application_id or candidate_submission_id)
	let app = await c.env.DB.prepare(`
		SELECT 
			a.id, 
			a.user_id, 
			a.job_id, 
			a.status, 
			a.candidate_submission_id,
			j.title AS job_title, 
			j.user_id AS job_owner_id,
			COALESCE(u.name, cand.name, 'Candidate') AS candidate_name,
			COALESCE(u.email, cand.email, '') AS candidate_email,
			hr.company_name
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		JOIN users hr ON hr.id = j.user_id
		LEFT JOIN users u ON u.id = a.user_id
		LEFT JOIN candidates cand ON cand.id = a.candidate_submission_id
		WHERE a.id = ?
	`)
		.bind(body.application_id)
		.first<{
			id: string;
			user_id: string | null;
			job_id: string;
			status: string;
			candidate_submission_id: string | null;
			job_title: string;
			job_owner_id: string;
			candidate_name: string;
			candidate_email: string;
			company_name: string | null;
		}>();

	if (!app) {
		// Fallback: match by candidate_submission_id
		app = await c.env.DB.prepare(`
			SELECT 
				a.id, 
				a.user_id, 
				a.job_id, 
				a.status, 
				a.candidate_submission_id,
				j.title AS job_title, 
				j.user_id AS job_owner_id,
				COALESCE(u.name, cand.name, 'Candidate') AS candidate_name,
				COALESCE(u.email, cand.email, '') AS candidate_email,
				hr.company_name
			FROM applications a
			JOIN jobs j ON j.id = a.job_id
			JOIN users hr ON hr.id = j.user_id
			LEFT JOIN users u ON u.id = a.user_id
			LEFT JOIN candidates cand ON cand.id = a.candidate_submission_id
			WHERE a.candidate_submission_id = ?
		`)
			.bind(body.application_id)
			.first<typeof app>();
	}

	if (!app) {
		return c.json({ error: "Application not found" }, 404);
	}

	if (app.job_owner_id !== hr.id) {
		return c.json({ error: "Forbidden: You do not own this job posting" }, 403);
	}

	// Resolve candidate email and name through multi-tier fallback
	let candidateEmail = (body.candidate_email || app.candidate_email || "").trim();
	let candidateName = (body.candidate_name || app.candidate_name || "Candidate").trim();

	if (!candidateEmail && app.user_id) {
		const u = await c.env.DB.prepare("SELECT email, name FROM users WHERE id = ?")
			.bind(app.user_id)
			.first<{ email: string; name: string }>();
		if (u?.email) {
			candidateEmail = u.email.trim();
			if (u.name && candidateName === "Candidate") candidateName = u.name.trim();
		}
	}

	if (!candidateEmail && app.candidate_submission_id) {
		const cand = await c.env.DB.prepare("SELECT email, name FROM candidates WHERE id = ?")
			.bind(app.candidate_submission_id)
			.first<{ email: string; name: string }>();
		if (cand?.email) {
			candidateEmail = cand.email.trim();
			if (cand.name && candidateName === "Candidate") candidateName = cand.name.trim();
		}
	}

	const interviewId = crypto.randomUUID();
	const candidateId = app.user_id || app.candidate_submission_id || app.id;
	const roundType = (body.round_type?.trim() || "Technical Round");
	const duration = body.duration_minutes && body.duration_minutes > 0 ? body.duration_minutes : 45;
	const meetingLink = body.meeting_link?.trim() || null;
	const notes = body.notes?.trim() || null;
	const now = new Date().toISOString();

	// 2. Insert interview record
	await c.env.DB.prepare(`
		INSERT INTO interviews (
			id, application_id, job_id, hr_id, candidate_id, 
			scheduled_at, duration_minutes, round_type, meeting_link, notes, status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
	`)
		.bind(
			interviewId,
			app.id,
			app.job_id,
			hr.id,
			candidateId,
			body.scheduled_at,
			duration,
			roundType,
			meetingLink,
			notes,
			now,
			now
		)
		.run();

	// 3. Automatically advance status to 'interview' if currently in early stages
	if (app.status === "applied" || app.status === "under_review" || app.status === "shortlisted") {
		await c.env.DB.prepare(`
			UPDATE applications 
			SET status = 'interview', changed_by_hr_id = ?, updated_at = ?
			WHERE id = ?
		`)
			.bind(hr.id, now, app.id)
			.run();

		// Log status transition
		await c.env.DB.prepare(`
			INSERT INTO application_status_log (id, application_id, from_status, to_status, changed_by_hr_id, note)
			VALUES (?, ?, ?, 'interview', ?, ?)
		`)
			.bind(
				crypto.randomUUID(),
				app.id,
				app.status,
				hr.id,
				`Interview scheduled: ${roundType}`
			)
			.run();

		// Notify CandidateStatusDO if user_id is linked
		if (app.user_id && c.env.CANDIDATE_STATUS) {
			try {
				const doId = c.env.CANDIDATE_STATUS.idFromName(app.user_id);
				const stub = c.env.CANDIDATE_STATUS.get(doId);
				await stub.fetch(new Request("https://do-internal/push", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "status_changed",
						application_id: app.id,
						status: "interview",
						updated_at: now,
					}),
				}));
			} catch (doErr) {
				console.error("[interviews] CandidateStatusDO error:", doErr);
			}
		}
	}

	// 4. Send transactional notification email to candidate
	let emailSent = false;
	let emailError: string | null = null;
	if (candidateEmail) {
		const formattedDate = new Date(body.scheduled_at).toLocaleString("en-US", {
			dateStyle: "full",
			timeStyle: "short",
		});

		try {
			const emailTpl = getInterviewScheduledEmail({
				candidateName,
				jobTitle: app.job_title,
				companyName: app.company_name || undefined,
				roundType,
				scheduledAtFormatted: formattedDate,
				durationMinutes: duration,
				meetingLink: meetingLink || undefined,
				notes: notes || undefined,
				dashboardUrl: "https://hiresight.shashishanthan2706.workers.dev/candidate/dashboard",
			});

			const emailResult = await sendEmail(c.env, {
				to: candidateEmail,
				subject: emailTpl.subject,
				html: emailTpl.html,
			});

			emailSent = emailResult.success;
			if (!emailResult.success) {
				emailError = emailResult.error || "Email delivery failed";
				console.error(`[interviews] Email dispatch to ${candidateEmail} failed:`, emailError);
			} else {
				console.log(`[interviews] Scheduled interview email dispatched successfully to ${candidateEmail}`);
			}
		} catch (err) {
			emailError = err instanceof Error ? err.message : String(err);
			console.error("[interviews] Failed to dispatch interview notification email:", err);
		}
	} else {
		console.warn("[interviews] No candidate email address available for application", app.id);
	}

	// 5. Send in-app message if candidate account exists
	if (app.user_id) {
		const msgId = crypto.randomUUID();
		const formattedDate = new Date(body.scheduled_at).toLocaleString("en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		});
		const msgBody = `Hi ${candidateName.split(" ")[0]},\n\nWe have scheduled your ${roundType} for the ${app.job_title} role on ${formattedDate} (${duration} mins).${meetingLink ? `\n\nMeeting Link: ${meetingLink}` : ""}${notes ? `\n\nNotes: ${notes}` : ""}\n\nPlease let us know if you need to reschedule.`;

		try {
			await c.env.DB.prepare(`
				INSERT INTO messages (id, from_user_id, to_user_id, application_id, subject, body, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`)
				.bind(
					msgId,
					hr.id,
					app.user_id,
					app.id,
					`Interview Scheduled: ${roundType} — ${app.job_title}`,
					msgBody,
					now
				)
				.run();
		} catch (msgErr) {
			console.error("[interviews] Failed to insert in-app message:", msgErr);
		}
	}

	return c.json({
		success: true,
		email_sent: emailSent,
		candidate_email: candidateEmail || null,
		email_error: emailError,
		interview: {
			id: interviewId,
			application_id: app.id,
			job_id: app.job_id,
			candidate_id: candidateId,
			round_type: roundType,
			scheduled_at: body.scheduled_at,
			duration_minutes: duration,
			meeting_link: meetingLink,
			notes,
			status: "scheduled",
			created_at: now,
		},
	}, 201);
});

// ── GET /api/interviews/application/:application_id — Get interviews for candidate ──
interviews.get("/application/:application_id", authenticate(), requireHR(), async (c) => {
	const hr = c.get("user");
	const applicationId = c.req.param("application_id");

	// Verify HR owns the job
	const app = await c.env.DB.prepare(`
		SELECT a.id, j.user_id AS job_owner_id
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		WHERE a.id = ?
	`)
		.bind(applicationId)
		.first<{ id: string; job_owner_id: string }>();

	if (!app || app.job_owner_id !== hr.id) {
		return c.json({ error: "Application not found or unauthorized" }, 404);
	}

	const { results } = await c.env.DB.prepare(`
		SELECT 
			id,
			application_id,
			job_id,
			hr_id,
			candidate_id,
			scheduled_at,
			duration_minutes,
			round_type,
			meeting_link,
			notes,
			status,
			feedback,
			rating,
			created_at,
			updated_at
		FROM interviews
		WHERE application_id = ?
		ORDER BY scheduled_at DESC
	`)
		.bind(applicationId)
		.all();

	return c.json(results ?? []);
});

// ── GET /api/interviews — HR lists all scheduled interviews ──────────────────
interviews.get("/", authenticate(), requireHR(), async (c) => {
	const hr = c.get("user");
	const status = c.req.query("status"); // optional filter
	const jobId = c.req.query("job_id");   // optional filter

	let query = `
		SELECT 
			i.id,
			i.application_id,
			i.job_id,
			i.hr_id,
			i.candidate_id,
			i.scheduled_at,
			i.duration_minutes,
			i.round_type,
			i.meeting_link,
			i.notes,
			i.status,
			i.feedback,
			i.rating,
			i.created_at,
			j.title AS job_title,
			COALESCE(u.name, cand.name, 'Candidate') AS candidate_name,
			COALESCE(u.email, cand.email, '') AS candidate_email,
			cand.id AS candidate_submission_id
		FROM interviews i
		JOIN jobs j ON j.id = i.job_id
		JOIN applications a ON a.id = i.application_id
		LEFT JOIN users u ON u.id = a.user_id
		LEFT JOIN candidates cand ON cand.id = a.candidate_submission_id
		WHERE i.hr_id = ?
	`;

	const bindings: string[] = [hr.id];

	if (status) {
		query += " AND i.status = ?";
		bindings.push(status);
	}
	if (jobId) {
		query += " AND i.job_id = ?";
		bindings.push(jobId);
	}

	query += " ORDER BY i.scheduled_at ASC";

	const stmt = c.env.DB.prepare(query);
	const { results } = await stmt.bind(...bindings).all();

	return c.json(results ?? []);
});

// ── GET /api/interviews/my — Candidate fetches their scheduled interviews ─────
interviews.get("/my", authenticate(), requireCandidate(), async (c) => {
	const user = c.get("user");

	const { results } = await c.env.DB.prepare(`
		SELECT 
			i.id,
			i.application_id,
			i.job_id,
			i.scheduled_at,
			i.duration_minutes,
			i.round_type,
			i.meeting_link,
			i.notes,
			i.status,
			i.created_at,
			j.title AS job_title,
			hr.name AS recruiter_name,
			hr.company_name
		FROM interviews i
		JOIN jobs j ON j.id = i.job_id
		JOIN applications a ON a.id = i.application_id
		JOIN users hr ON hr.id = i.hr_id
		WHERE (i.candidate_id = ? OR a.user_id = ?)
		ORDER BY i.scheduled_at ASC
	`)
		.bind(user.id, user.id)
		.all();

	return c.json(results ?? []);
});

// ── PATCH /api/interviews/:id — Update interview details/feedback ────────────
interviews.patch("/:id", authenticate(), requireHR(), async (c) => {
	const hr = c.get("user");
	const id = c.req.param("id");
	const body = await c.req.json<{
		scheduled_at?: string;
		duration_minutes?: number;
		round_type?: string;
		meeting_link?: string;
		notes?: string;
		status?: string;
		feedback?: string;
		rating?: number;
	}>();

	// Verify ownership
	const existing = await c.env.DB.prepare(`
		SELECT id, hr_id, application_id, status FROM interviews WHERE id = ?
	`)
		.bind(id)
		.first<{ id: string; hr_id: string; application_id: string; status: string }>();

	if (!existing || existing.hr_id !== hr.id) {
		return c.json({ error: "Interview not found or unauthorized" }, 404);
	}

	const updates: string[] = [];
	const bindings: (string | number | null)[] = [];

	if (body.scheduled_at !== undefined) {
		updates.push("scheduled_at = ?");
		bindings.push(body.scheduled_at);
	}
	if (body.duration_minutes !== undefined) {
		updates.push("duration_minutes = ?");
		bindings.push(body.duration_minutes);
	}
	if (body.round_type !== undefined) {
		updates.push("round_type = ?");
		bindings.push(body.round_type.trim());
	}
	if (body.meeting_link !== undefined) {
		updates.push("meeting_link = ?");
		bindings.push(body.meeting_link.trim() || null);
	}
	if (body.notes !== undefined) {
		updates.push("notes = ?");
		bindings.push(body.notes.trim() || null);
	}
	if (body.status !== undefined) {
		updates.push("status = ?");
		bindings.push(body.status.trim());
	}
	if (body.feedback !== undefined) {
		updates.push("feedback = ?");
		bindings.push(body.feedback.trim() || null);
	}
	if (body.rating !== undefined) {
		updates.push("rating = ?");
		bindings.push(body.rating);
	}

	if (updates.length === 0) {
		return c.json({ ok: true, changed: false });
	}

	const now = new Date().toISOString();
	updates.push("updated_at = ?");
	bindings.push(now);

	bindings.push(id);

	await c.env.DB.prepare(`
		UPDATE interviews 
		SET ${updates.join(", ")}
		WHERE id = ?
	`)
		.bind(...bindings)
		.run();

	return c.json({ ok: true, updated_at: now });
});

// ── DELETE /api/interviews/:id — Delete / cancel an interview ────────────────
interviews.delete("/:id", authenticate(), requireHR(), async (c) => {
	const hr = c.get("user");
	const id = c.req.param("id");

	const result = await c.env.DB.prepare(`
		DELETE FROM interviews WHERE id = ? AND hr_id = ?
	`)
		.bind(id, hr.id)
		.run();

	if (result.meta.changes === 0) {
		return c.json({ error: "Interview not found or unauthorized" }, 404);
	}

	return c.json({ ok: true });
});

export default interviews;
