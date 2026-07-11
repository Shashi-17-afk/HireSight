// ─────────────────────────────────────────────────────────────────────────────
// ATS shared types — used by worker routes and (via import) by the frontend.
// These mirror the D1 schema defined in migrations/0003_ats_core.sql exactly.
// ─────────────────────────────────────────────────────────────────────────────

// ── jobs.status ───────────────────────────────────────────────────────────────

export type JobStatus = 'open' | 'closed' | 'draft';

// ── candidate_profiles ────────────────────────────────────────────────────────

export type Availability     = 'immediate' | '2_weeks' | '1_month' | 'not_looking';
export type PreferredRoleType = 'full_time' | 'part_time' | 'contract' | 'remote';

/**
 * One row per authenticated candidate user.
 * is_complete = true when phone + location + (linkedin_url OR github_url) are
 * all non-null and non-empty.  Computed server-side on every save.
 *
 * D1 stores boolean as INTEGER 0/1; the server converts to boolean on read.
 */
export interface CandidateProfile {
	user_id: string;

	// Contact & links
	phone:          string | null;
	linkedin_url:   string | null;
	github_url:     string | null;
	portfolio_url:  string | null;
	/** URL to a hosted resume file. Separate from candidates.resume_text (AI scoring). */
	resume_url:     string | null;

	// Professional identity
	headline:       string | null;   // optional — not required for is_complete
	bio:            string | null;
	location:       string | null;   // required for is_complete

	// ATS metadata
	years_of_experience: number | null;
	/** Stored as CSV in D1; split into string[] by the server on read. */
	skills:              string | null;
	availability:        Availability      | null;
	preferred_role_type: PreferredRoleType | null;
	expected_salary:     string | null;   // free text e.g. "₹15–20 LPA"

	is_complete: boolean;
	updated_at:  string;   // ISO 8601 timestamp string from D1
}

/**
 * Subset sent to the client on GET /api/profile (omits nothing sensitive here,
 * but gives us a clear boundary to extend if we add sensitive fields later).
 */
export type CandidateProfilePublic = CandidateProfile;

/**
 * Body accepted by PUT /api/profile.
 * user_id, is_complete, and updated_at are server-managed — never accepted from client.
 */
export type CandidateProfileUpdate = Omit<CandidateProfile, 'user_id' | 'is_complete' | 'updated_at'>;

// ── applications ──────────────────────────────────────────────────────────────

export type ApplicationStatus =
	| 'applied'
	| 'under_review'
	| 'shortlisted'
	| 'interview'
	| 'rejected'
	| 'hired';

export type ApplicationSource = 'browse' | 'link';

/** All allowed forward/backward transitions in the status pipeline. */
export const APPLICATION_STATUSES: ApplicationStatus[] = [
	'applied',
	'under_review',
	'shortlisted',
	'interview',
	'rejected',
	'hired',
];

/**
 * One row per application.
 * user_id is null for anonymous link-based applications (no account required).
 * candidate_submission_id references candidates.id (the AI-scoring record).
 */
export interface Application {
	id:                      string;
	user_id:                 string | null;   // null = anonymous link apply
	job_id:                  string;
	candidate_submission_id: string | null;   // FK → candidates(id)
	status:                  ApplicationStatus;
	source:                  ApplicationSource;
	applied_at:              string;
	updated_at:              string;
	changed_by_hr_id:        string | null;
}

/**
 * Application enriched with job title and candidate name — used in list views.
 */
export interface ApplicationWithContext extends Application {
	job_title:       string;
	candidate_name:  string;   // from users.name or candidates.name for anonymous
	ai_score:        number | null;
	ai_reasoning:    string | null;
}

// ── application_status_log ────────────────────────────────────────────────────

export interface ApplicationStatusLogEntry {
	id:               string;
	application_id:   string;
	from_status:      ApplicationStatus | null;   // null on initial creation
	to_status:        ApplicationStatus;
	changed_by_hr_id: string | null;
	changed_at:       string;
	note:             string | null;
}

// ── Helper: compute is_complete server-side ───────────────────────────────────

/**
 * Single source of truth for the is_complete rule.
 * Call this before every INSERT/UPDATE on candidate_profiles.
 */
export function computeIsComplete(
	profile: Pick<CandidateProfile, 'phone' | 'location' | 'linkedin_url' | 'github_url'>
): boolean {
	const filled = (v: string | null | undefined) => typeof v === 'string' && v.trim().length > 0;
	return (
		filled(profile.phone) &&
		filled(profile.location) &&
		(filled(profile.linkedin_url) || filled(profile.github_url))
	);
}
