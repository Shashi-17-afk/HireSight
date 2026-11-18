import { Hono } from "hono";
import { authenticate, requireHR, requireCandidate } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";

type AppEnv = { Bindings: Env; Variables: AuthVariables };

const messages = new Hono<AppEnv>();

// ── POST /api/messages — HR sends a message to a candidate ────────────────────
// Body: { to_user_id?, application_id?, candidate_submission_id?, candidate_email?, subject, body }
// If to_user_id is omitted, we resolve the candidate's user_id from application_id,
// candidate_submission_id, or candidate_email.
messages.post("/", authenticate(), requireHR(), async (c) => {
	const hr = c.get("user");
	const body = await c.req.json<{
		to_user_id?: string | null;
		subject: string;
		body: string;
		application_id?: string | null;
		candidate_submission_id?: string | null;
		candidate_email?: string | null;
	}>();

	if (!body.subject?.trim() || !body.body?.trim()) {
		return c.json({ error: "subject and body are required" }, 400);
	}

	let toUserId = body.to_user_id?.trim() || null;
	let applicationId = body.application_id?.trim() || null;

	// 1. Resolve from application if to_user_id not given directly
	if (!toUserId && applicationId) {
		const app = await c.env.DB.prepare(
			"SELECT id, user_id FROM applications WHERE id = ?"
		)
			.bind(applicationId)
			.first<{ id: string; user_id: string | null }>();

		if (app?.user_id) {
			toUserId = app.user_id;
		}
	}

	// 2. Resolve from candidate_submission_id if still not resolved
	if (!toUserId && body.candidate_submission_id?.trim()) {
		const subId = body.candidate_submission_id.trim();

		// Check applications table first
		const app = await c.env.DB.prepare(
			"SELECT id, user_id FROM applications WHERE candidate_submission_id = ? AND user_id IS NOT NULL"
		)
			.bind(subId)
			.first<{ id: string; user_id: string }>();

		if (app) {
			toUserId = app.user_id;
			if (!applicationId) applicationId = app.id;
		} else {
			// Check candidates table + users table by email
			const cand = await c.env.DB.prepare(
				`SELECT c.job_id, u.id AS user_id, c.created_at
				 FROM candidates c
				 JOIN users u ON LOWER(u.email) = LOWER(c.email)
				 WHERE c.id = ? AND u.role = 'candidate'`
			)
				.bind(subId)
				.first<{ job_id: string; user_id: string; created_at: string }>();

			if (cand) {
				toUserId = cand.user_id;
				if (!applicationId && cand.job_id) {
					const existingApp = await c.env.DB.prepare(
						"SELECT id FROM applications WHERE user_id = ? AND job_id = ?"
					)
						.bind(cand.user_id, cand.job_id)
						.first<{ id: string }>();
					if (existingApp) {
						applicationId = existingApp.id;
					}
				}
			}
		}
	}

	// 3. Resolve from candidate_email if still not resolved
	if (!toUserId && body.candidate_email?.trim()) {
		const candUser = await c.env.DB.prepare(
			"SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND role = 'candidate'"
		)
			.bind(body.candidate_email.trim())
			.first<{ id: string }>();

		if (candUser) {
			toUserId = candUser.id;
		}
	}

	if (!toUserId) {
		return c.json(
			{ error: "This candidate has not created a candidate account yet. Please use the 'Email directly' button to contact them via email." },
			400
		);
	}

	// Verify the target user exists and is a candidate
	const target = await c.env.DB.prepare(
		"SELECT id FROM users WHERE id = ? AND role = 'candidate'"
	)
		.bind(toUserId)
		.first<{ id: string }>();

	if (!target) {
		return c.json(
			{ error: "This candidate has not created a candidate account yet. Please use the 'Email directly' button to contact them via email." },
			404
		);
	}

	// Verify applicationId exists in applications table (foreign key constraint)
	if (applicationId) {
		const validApp = await c.env.DB.prepare(
			"SELECT id FROM applications WHERE id = ?"
		)
			.bind(applicationId)
			.first<{ id: string }>();

		if (!validApp) {
			applicationId = null;
		}
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		`INSERT INTO messages (id, from_user_id, to_user_id, application_id, subject, body, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			id,
			hr.id,
			toUserId,
			applicationId,
			body.subject.trim(),
			body.body.trim(),
			now
		)
		.run();

	return c.json({ id, created_at: now }, 201);
});


// ── GET /api/messages/inbox — Candidate reads their inbox ────────────────────
messages.get("/inbox", authenticate(), requireCandidate(), async (c) => {
	const user = c.get("user");

	const rows = await c.env.DB.prepare(
		`SELECT
			m.id,
			m.from_user_id,
			u.name AS from_name,
			m.application_id,
			a_job.title AS job_title,
			m.subject,
			m.body,
			m.created_at,
			m.read_at
		FROM messages m
		JOIN users u ON u.id = m.from_user_id
		LEFT JOIN applications app ON app.id = m.application_id
		LEFT JOIN jobs a_job ON a_job.id = app.job_id
		WHERE m.to_user_id = ?
		ORDER BY m.created_at DESC
		LIMIT 50`
	)
		.bind(user.id)
		.all<{
			id: string;
			from_user_id: string;
			from_name: string;
			application_id: string | null;
			job_title: string | null;
			subject: string;
			body: string;
			created_at: string;
			read_at: string | null;
		}>();

	return c.json(rows.results ?? []);
});

// ── GET /api/messages/sent — HR reads their sent messages ────────────────────
messages.get("/sent", authenticate(), requireHR(), async (c) => {
	const user = c.get("user");

	const rows = await c.env.DB.prepare(
		`SELECT
			m.id,
			m.to_user_id,
			u.name AS to_name,
			m.application_id,
			m.subject,
			m.body,
			m.created_at,
			m.read_at
		FROM messages m
		JOIN users u ON u.id = m.to_user_id
		WHERE m.from_user_id = ?
		ORDER BY m.created_at DESC
		LIMIT 50`
	)
		.bind(user.id)
		.all<{
			id: string;
			to_user_id: string;
			to_name: string;
			application_id: string | null;
			subject: string;
			body: string;
			created_at: string;
			read_at: string | null;
		}>();

	return c.json(rows.results ?? []);
});

// ── PATCH /api/messages/:id/read — Candidate marks a message as read ─────────
messages.patch("/:id/read", authenticate(), requireCandidate(), async (c) => {
	const user = c.get("user");
	const messageId = c.req.param("id");
	const now = new Date().toISOString();

	const result = await c.env.DB.prepare(
		"UPDATE messages SET read_at = ? WHERE id = ? AND to_user_id = ? AND read_at IS NULL"
	)
		.bind(now, messageId, user.id)
		.run();

	if (result.meta.changes === 0) {
		return c.json({ ok: true, changed: false });
	}

	return c.json({ ok: true, changed: true, read_at: now });
});

// ── GET /api/messages/unread-count — quick badge count for candidate ─────────
messages.get("/unread-count", authenticate(), requireCandidate(), async (c) => {
	const user = c.get("user");

	const row = await c.env.DB.prepare(
		"SELECT COUNT(*) as count FROM messages WHERE to_user_id = ? AND read_at IS NULL"
	)
		.bind(user.id)
		.first<{ count: number }>();

	return c.json({ count: row?.count ?? 0 });
});

// ── DELETE /api/messages/:id — sender or recipient can delete ─────────────────
messages.delete("/:id", authenticate(), async (c) => {
	const user = c.get("user");
	const messageId = c.req.param("id");

	const result = await c.env.DB.prepare(
		"DELETE FROM messages WHERE id = ? AND (from_user_id = ? OR to_user_id = ?)"
	)
		.bind(messageId, user.id, user.id)
		.run();

	if (result.meta.changes === 0) {
		return c.json({ error: "Message not found" }, 404);
	}

	return c.json({ ok: true });
});

export default messages;
