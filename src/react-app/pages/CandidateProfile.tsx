import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

type Availability = "immediate" | "2_weeks" | "1_month" | "not_looking" | "";
type RoleType     = "full_time" | "part_time" | "contract" | "remote" | "";

interface FormState {
	// Required for is_complete
	phone:        string;
	location:     string;
	linkedin_url: string;
	github_url:   string;
	// Optional
	portfolio_url:       string;
	resume_url:          string;
	headline:            string;
	bio:                 string;
	years_of_experience: string;
	skills:              string;
	availability:        Availability;
	preferred_role_type: RoleType;
	expected_salary:     string;
}

interface ZodIssue {
	path: string[];
	message: string;
}

const EMPTY: FormState = {
	phone: "", location: "", linkedin_url: "", github_url: "",
	portfolio_url: "", resume_url: "", headline: "", bio: "",
	years_of_experience: "", skills: "", availability: "",
	preferred_role_type: "", expected_salary: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function filled(v: string) { return v.trim().length > 0; }

function clientIsComplete(f: FormState): boolean {
	return filled(f.phone) && filled(f.location) && (filled(f.linkedin_url) || filled(f.github_url));
}

function fieldError(issues: ZodIssue[], name: string): string | undefined {
	return issues.find((i) => i.path[0] === name)?.message;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidateProfile() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const redirect = searchParams.get("redirect");

	const [form, setForm]           = useState<FormState>(EMPTY);
	const [loading, setLoading]     = useState(true);
	const [loadError, setLoadError] = useState("");
	const [saving, setSaving]       = useState(false);
	const [saveError, setSaveError] = useState("");
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [issues, setIssues]       = useState<ZodIssue[]>([]);

	const token = localStorage.getItem("token");

	// Pre-populate form from server on mount
	useEffect(() => {
		if (!token) { setLoading(false); return; }

		fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data: { exists: boolean; profile: Record<string, unknown> | null }) => {
				if (data.exists && data.profile) {
					const p = data.profile;
					setForm({
						phone:               String(p["phone"]        ?? ""),
						location:            String(p["location"]     ?? ""),
						linkedin_url:        String(p["linkedin_url"] ?? ""),
						github_url:          String(p["github_url"]   ?? ""),
						portfolio_url:       String(p["portfolio_url"] ?? ""),
						resume_url:          String(p["resume_url"]   ?? ""),
						headline:            String(p["headline"]     ?? ""),
						bio:                 String(p["bio"]          ?? ""),
						years_of_experience: p["years_of_experience"] != null ? String(p["years_of_experience"]) : "",
						skills:              String(p["skills"]       ?? ""),
						availability:        (p["availability"]        as Availability)  ?? "",
						preferred_role_type: (p["preferred_role_type"] as RoleType)      ?? "",
						expected_salary:     String(p["expected_salary"] ?? ""),
					});
				}
			})
			.catch(() => setLoadError("Could not load your profile. Please refresh."))
			.finally(() => setLoading(false));
	}, [token]);

	function set(key: keyof FormState, val: string) {
		setSaveSuccess(false);
		setForm((f) => ({ ...f, [key]: val }));
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setSaveError("");
		setIssues([]);
		setSaveSuccess(false);

		const body = {
			phone:               filled(form.phone)        ? form.phone.trim()        : null,
			location:            filled(form.location)     ? form.location.trim()     : null,
			linkedin_url:        filled(form.linkedin_url) ? form.linkedin_url.trim() : null,
			github_url:          filled(form.github_url)   ? form.github_url.trim()   : null,
			portfolio_url:       filled(form.portfolio_url) ? form.portfolio_url.trim() : null,
			resume_url:          filled(form.resume_url)   ? form.resume_url.trim()   : null,
			headline:            filled(form.headline)     ? form.headline.trim()     : null,
			bio:                 filled(form.bio)          ? form.bio.trim()          : null,
			years_of_experience: form.years_of_experience ? parseInt(form.years_of_experience, 10) : null,
			skills:              filled(form.skills)       ? form.skills.trim()       : null,
			availability:        form.availability        || null,
			preferred_role_type: form.preferred_role_type || null,
			expected_salary:     filled(form.expected_salary) ? form.expected_salary.trim() : null,
		};

		try {
			const res = await fetch("/api/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify(body),
			});
			const data = await res.json() as { error?: string; issues?: ZodIssue[] };

			if (!res.ok) {
				if (data.issues) setIssues(data.issues);
				else setSaveError(data.error ?? "Failed to save profile.");
				return;
			}

			setSaveSuccess(true);
			// If arriving via gate redirect, send the candidate straight to the job
			if (redirect) navigate(redirect);
		} catch {
			setSaveError("Network error. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	const isComplete = clientIsComplete(form);

	if (loading) {
		return (
			<div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
				<span className="spinner" style={{ borderTopColor: "var(--brand)" }} />
				<p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>Loading profile…</p>
			</div>
		);
	}

	if (loadError) {
		return (
			<div className="page">
				<div className="card" style={{ textAlign: "center" }}>
					<p className="error-text">{loadError}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="page" style={{ maxWidth: 660 }}>

			{/* Gate banner — only shown when arriving from the apply gate */}
			{redirect && (
				<div className="profile-banner">
					<span className="profile-banner-icon">📋</span>
					<div>
						<strong>Complete your profile to apply</strong>
						<p>Fill in the 3 required fields below. You'll be taken straight to the job after saving.</p>
					</div>
				</div>
			)}

			<div style={{ marginBottom: "2rem" }}>
				<h1 style={{ fontSize: "1.55rem", fontWeight: 700, marginBottom: ".4rem" }}>
					Your Profile
				</h1>
				<div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
					<span className={`complete-badge ${isComplete ? "complete-badge-yes" : "complete-badge-no"}`}>
						{isComplete ? "✓ Profile complete" : "○ Profile incomplete"}
					</span>
					{!isComplete && (
						<span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
							— phone + location + LinkedIn or GitHub required
						</span>
					)}
				</div>
			</div>

			<form onSubmit={handleSubmit} noValidate>

				{/* ── Required fields ─────────────────────────────────────────── */}
				<div className="form-section">
					<div className="form-section-header">Required to apply</div>

					<div className="form-row-2">
						<div className="form-group">
							<label className="label" htmlFor="phone">Phone *</label>
							<input
								id="phone"
								type="tel"
								className={`input ${fieldError(issues, "phone") ? "input-error" : ""}`}
								placeholder="+91 98765 43210"
								value={form.phone}
								onChange={(e) => set("phone", e.target.value)}
							/>
							{fieldError(issues, "phone") && <p className="field-error">{fieldError(issues, "phone")}</p>}
						</div>

						<div className="form-group">
							<label className="label" htmlFor="location">Location *</label>
							<input
								id="location"
								type="text"
								className={`input ${fieldError(issues, "location") ? "input-error" : ""}`}
								placeholder="Bengaluru, India"
								value={form.location}
								onChange={(e) => set("location", e.target.value)}
							/>
							{fieldError(issues, "location") && <p className="field-error">{fieldError(issues, "location")}</p>}
						</div>
					</div>

					<div className="form-row-2">
						<div className="form-group">
							<label className="label" htmlFor="linkedin_url">LinkedIn URL *†</label>
							<input
								id="linkedin_url"
								type="url"
								className={`input ${fieldError(issues, "linkedin_url") ? "input-error" : ""}`}
								placeholder="https://linkedin.com/in/you"
								value={form.linkedin_url}
								onChange={(e) => set("linkedin_url", e.target.value)}
							/>
							{fieldError(issues, "linkedin_url") && <p className="field-error">{fieldError(issues, "linkedin_url")}</p>}
						</div>

						<div className="form-group">
							<label className="label" htmlFor="github_url">GitHub URL *†</label>
							<input
								id="github_url"
								type="url"
								className={`input ${fieldError(issues, "github_url") ? "input-error" : ""}`}
								placeholder="https://github.com/you"
								value={form.github_url}
								onChange={(e) => set("github_url", e.target.value)}
							/>
							{fieldError(issues, "github_url") && <p className="field-error">{fieldError(issues, "github_url")}</p>}
						</div>
					</div>
					<p style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: "-.5rem", marginBottom: ".25rem" }}>
						† At least one of LinkedIn or GitHub is required.
					</p>
				</div>

				{/* ── Professional summary ────────────────────────────────────── */}
				<div className="form-section">
					<div className="form-section-header">Professional summary</div>

					<div className="form-group">
						<label className="label" htmlFor="headline">Headline</label>
						<input
							id="headline"
							type="text"
							className="input"
							placeholder='e.g. "Full-Stack Engineer · 3 yrs · TypeScript + Go"'
							maxLength={120}
							value={form.headline}
							onChange={(e) => set("headline", e.target.value)}
						/>
					</div>

					<div className="form-group">
						<label className="label" htmlFor="bio">Bio</label>
						<textarea
							id="bio"
							className="input"
							placeholder="A short intro about your background and what you're looking for…"
							rows={4}
							maxLength={1000}
							value={form.bio}
							onChange={(e) => set("bio", e.target.value)}
							style={{ resize: "vertical" }}
						/>
						<p style={{ fontSize: ".72rem", color: "var(--text-muted)", textAlign: "right", marginTop: ".25rem" }}>
							{form.bio.length}/1000
						</p>
					</div>

					<div className="form-row-2">
						<div className="form-group">
							<label className="label" htmlFor="years">Years of experience</label>
							<input
								id="years"
								type="number"
								className="input"
								placeholder="3"
								min={0}
								max={60}
								value={form.years_of_experience}
								onChange={(e) => set("years_of_experience", e.target.value)}
							/>
						</div>

						<div className="form-group">
							<label className="label" htmlFor="skills">Skills</label>
							<input
								id="skills"
								type="text"
								className="input"
								placeholder="TypeScript, React, Go, Postgres"
								value={form.skills}
								onChange={(e) => set("skills", e.target.value)}
							/>
							<p style={{ fontSize: ".72rem", color: "var(--text-muted)", marginTop: ".25rem" }}>
								Comma-separated
							</p>
						</div>
					</div>
				</div>

				{/* ── Preferences ─────────────────────────────────────────────── */}
				<div className="form-section">
					<div className="form-section-header">Preferences</div>

					<div className="form-row-2">
						<div className="form-group">
							<label className="label" htmlFor="role_type">Role type</label>
							<select
								id="role_type"
								className="input"
								value={form.preferred_role_type}
								onChange={(e) => set("preferred_role_type", e.target.value as RoleType)}
							>
								<option value="">— Select —</option>
								<option value="full_time">Full-time</option>
								<option value="part_time">Part-time</option>
								<option value="contract">Contract</option>
								<option value="remote">Remote</option>
							</select>
						</div>

						<div className="form-group">
							<label className="label" htmlFor="availability">Availability</label>
							<select
								id="availability"
								className="input"
								value={form.availability}
								onChange={(e) => set("availability", e.target.value as Availability)}
							>
								<option value="">— Select —</option>
								<option value="immediate">Immediate</option>
								<option value="2_weeks">2 weeks notice</option>
								<option value="1_month">1 month notice</option>
								<option value="not_looking">Not actively looking</option>
							</select>
						</div>
					</div>

					<div className="form-group">
						<label className="label" htmlFor="salary">Expected salary</label>
						<input
							id="salary"
							type="text"
							className="input"
							placeholder='e.g. "₹15–20 LPA" or "$120k"'
							value={form.expected_salary}
							onChange={(e) => set("expected_salary", e.target.value)}
						/>
					</div>
				</div>

				{/* ── Links ───────────────────────────────────────────────────── */}
				<div className="form-section">
					<div className="form-section-header">Additional links</div>

					<div className="form-row-2">
						<div className="form-group">
							<label className="label" htmlFor="portfolio_url">Portfolio</label>
							<input
								id="portfolio_url"
								type="url"
								className={`input ${fieldError(issues, "portfolio_url") ? "input-error" : ""}`}
								placeholder="https://yoursite.com"
								value={form.portfolio_url}
								onChange={(e) => set("portfolio_url", e.target.value)}
							/>
							{fieldError(issues, "portfolio_url") && <p className="field-error">{fieldError(issues, "portfolio_url")}</p>}
						</div>

						<div className="form-group">
							<label className="label" htmlFor="resume_url">Resume URL</label>
							<input
								id="resume_url"
								type="url"
								className={`input ${fieldError(issues, "resume_url") ? "input-error" : ""}`}
								placeholder="https://drive.google.com/…"
								value={form.resume_url}
								onChange={(e) => set("resume_url", e.target.value)}
							/>
							{fieldError(issues, "resume_url") && <p className="field-error">{fieldError(issues, "resume_url")}</p>}
						</div>
					</div>
				</div>

				{/* ── Submit ──────────────────────────────────────────────────── */}
				{saveError && (
					<p className="error-text" style={{ marginBottom: "1rem", justifyContent: "flex-start" }}>
						⚠ {saveError}
					</p>
				)}
				{saveSuccess && !redirect && (
					<p style={{ marginBottom: "1rem", color: "var(--success)", fontWeight: 600, fontSize: ".9rem" }}>
						✓ Profile saved successfully.
					</p>
				)}

				<div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={saving}
						style={{ minWidth: 160 }}
					>
						{saving
							? <><span className="spinner" /> Saving…</>
							: redirect
								? "Save & Continue →"
								: "Save Profile"}
					</button>

					{!redirect && (
						<button
							type="button"
							className="btn btn-outline"
							onClick={() => navigate("/candidate/dashboard")}
						>
							Back to Dashboard
						</button>
					)}
				</div>

			</form>
		</div>
	);
}
