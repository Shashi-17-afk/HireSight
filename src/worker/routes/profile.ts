import { Hono } from 'hono';
import { authenticate, requireCandidate } from '../lib/auth';
import type { AuthVariables } from '../lib/auth';
import { profileBodySchema } from '../lib/profileSchema';
import { computeIsComplete } from '../types/ats';
import { auditResumeForCandidate } from '../lib/cv-analysis';

const profile = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ── GET /api/profile ──────────────────────────────────────────────────────────
// Returns the current candidate's profile, or { exists: false } if never saved.
profile.get('/', authenticate(), requireCandidate(), async (c) => {
	const { id } = c.get('user');

	const row = await c.env.DB.prepare(
		'SELECT * FROM candidate_profiles WHERE user_id = ?'
	).bind(id).first<Record<string, unknown>>();

	if (!row) return c.json({ exists: false, profile: null });

	return c.json({
		exists: true,
		profile: { ...row, is_complete: row['is_complete'] === 1 },
	});
});

// ── PUT /api/profile ──────────────────────────────────────────────────────────
// Upsert (create or update) the candidate's profile.
// Computes is_complete server-side using the single-source-of-truth helper.
profile.put('/', authenticate(), requireCandidate(), async (c) => {
	const { id } = c.get('user');

	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	const parsed = profileBodySchema.safeParse(rawBody);
	if (!parsed.success) {
		return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
	}

	const d = parsed.data;

	const isComplete = computeIsComplete({
		phone:        d.phone        ?? null,
		location:     d.location     ?? null,
		linkedin_url: d.linkedin_url ?? null,
		github_url:   d.github_url   ?? null,
	});

	// SQLite UPSERT — creates on first save, updates on subsequent saves.
	await c.env.DB.prepare(`
		INSERT INTO candidate_profiles
			(user_id, phone, linkedin_url, github_url, portfolio_url, resume_url,
			 headline, bio, location, years_of_experience, skills,
			 availability, preferred_role_type, expected_salary,
			 is_complete, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET
			phone               = excluded.phone,
			linkedin_url        = excluded.linkedin_url,
			github_url          = excluded.github_url,
			portfolio_url       = excluded.portfolio_url,
			resume_url          = excluded.resume_url,
			headline            = excluded.headline,
			bio                 = excluded.bio,
			location            = excluded.location,
			years_of_experience = excluded.years_of_experience,
			skills              = excluded.skills,
			availability        = excluded.availability,
			preferred_role_type = excluded.preferred_role_type,
			expected_salary     = excluded.expected_salary,
			is_complete         = excluded.is_complete,
			updated_at          = CURRENT_TIMESTAMP
	`).bind(
		id,
		d.phone        ?? null,
		d.linkedin_url ?? null,
		d.github_url   ?? null,
		d.portfolio_url ?? null,
		d.resume_url   ?? null,
		d.headline     ?? null,
		d.bio          ?? null,
		d.location     ?? null,
		d.years_of_experience ?? null,
		d.skills       ?? null,
		d.availability ?? null,
		d.preferred_role_type ?? null,
		d.expected_salary ?? null,
		isComplete ? 1 : 0,
	).run();

	const saved = await c.env.DB.prepare(
		'SELECT * FROM candidate_profiles WHERE user_id = ?'
	).bind(id).first<Record<string, unknown>>();

	return c.json({ ...saved, is_complete: saved?.['is_complete'] === 1 });
});

// ── POST /api/profile/cv-analysis ───────────────────────────────────────────
// Authenticated candidate evaluates their own resume text or past submission.
profile.post('/cv-analysis', authenticate(), requireCandidate(), async (c) => {
	const { id } = c.get('user');

	let body: { resumeText?: string; targetRole?: string; targetJd?: string } = {};
	try {
		body = await c.req.json();
	} catch {
		body = {};
	}

	let resumeText = body.resumeText?.trim();

	// If no resumeText provided in body, load their latest submitted resume from candidates
	if (!resumeText) {
		const latestApp = await c.env.DB.prepare(`
			SELECT cand.resume_text
			FROM applications a
			JOIN candidates cand ON cand.id = a.candidate_submission_id
			WHERE a.user_id = ?
			ORDER BY a.applied_at DESC
			LIMIT 1
		`).bind(id).first<{ resume_text: string }>();

		if (latestApp?.resume_text) {
			resumeText = latestApp.resume_text;
		}
	}

	// If still no resume text, check their profile skills/bio
	if (!resumeText) {
		const prof = await c.env.DB.prepare(`
			SELECT headline, bio, skills, years_of_experience FROM candidate_profiles WHERE user_id = ?
		`).bind(id).first<{ headline?: string; bio?: string; skills?: string; years_of_experience?: number }>();

		if (prof?.skills || prof?.headline || prof?.bio) {
			resumeText = `Candidate Headline: ${prof.headline || ''}\nExperience: ${prof.years_of_experience || ''} years\nSkills: ${prof.skills || ''}\nBio: ${prof.bio || ''}`;
		}
	}

	if (!resumeText || resumeText.length < 20) {
		return c.json({
			error: 'No resume content found. Please paste or upload your resume text to analyze.',
			hasResume: false,
		}, 400);
	}

	const audit = await auditResumeForCandidate(c.env.AI, resumeText, body.targetRole, body.targetJd);
	if (!audit) {
		return c.json({ error: 'AI analysis model could not process resume. Please try again.' }, 502);
	}

	return c.json({
		success: true,
		resumeSnippet: resumeText.slice(0, 500),
		hasResume: true,
		audit,
	});
});

export default profile;
