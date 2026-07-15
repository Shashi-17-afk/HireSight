import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Seo from "../components/Seo";

interface JobFull {
	id: string;
	title: string;
	description: string;
	created_at: string;
	status: string;
	applicant_count: number;
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	return `${months}mo ago`;
}

/**
 * Renders plain-text job descriptions with basic structure:
 * double-newlines → paragraphs, lines starting with - / * / • → bullet list.
 */
function DescriptionRenderer({ text }: { text: string }) {
	const paragraphs = text.split(/\n{2,}/);

	return (
		<div className="job-detail-description">
			{paragraphs.map((para, pi) => {
				const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
				const isList = lines.every((l) => /^[-*•]/.test(l));

				if (isList) {
					return (
						<ul key={pi} className="job-detail-list">
							{lines.map((l, li) => (
								<li key={li}>{l.replace(/^[-*•]\s*/, "")}</li>
							))}
						</ul>
					);
				}

				// Mixed block — render lines with breaks
				return (
					<p key={pi} className="job-detail-para">
						{lines.map((l, li) => (
							<span key={li}>
								{l}
								{li < lines.length - 1 && <br />}
							</span>
						))}
					</p>
				);
			})}
		</div>
	);
}

export default function JobDetail() {
	const { job_id } = useParams<{ job_id: string }>();
	const navigate = useNavigate();

	const [job, setJob] = useState<JobFull | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	// Auth state for gate logic
	const token = localStorage.getItem("token");
	const role  = localStorage.getItem("role");
	const isCandidate = !!token && role === "candidate";

	useEffect(() => {
		if (!job_id) return;
		fetch(`/api/jobs/${job_id}`)
			.then((r) => r.json())
			.then((data: unknown) => {
				const d = data as JobFull & { error?: string };
				if (d.error) setError(d.error);
				else setJob(d);
			})
			.catch(() => setError("Could not load job details. Please try again."))
			.finally(() => setLoading(false));
	}, [job_id]);

	async function handleApply() {
		if (!isCandidate) {
			navigate(`/login/candidate?redirect=/apply/${job_id}`);
			return;
		}
		// Check profile completeness
		try {
			const res = await fetch("/api/profile", {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json() as { profile?: { is_complete: boolean } | null };
			if (!data.profile?.is_complete) {
				navigate(`/candidate/profile?redirect=/apply/${job_id}`);
				return;
			}
		} catch {
			// Network issue — let the apply page handle it
		}
		navigate(`/apply/${job_id}`);
	}

	// ── Loading ──────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="page" style={{ textAlign: "center", paddingTop: "5rem" }}>
				<span className="spinner" style={{ borderTopColor: "var(--brand)" }} />
				<p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: ".9rem" }}>Loading job details…</p>
			</div>
		);
	}

	// ── Error ────────────────────────────────────────────────────────────────
	if (error || !job) {
		return (
			<div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
				<div className="card" style={{ maxWidth: 440, margin: "0 auto", padding: "2.5rem" }}>
					<div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
					<p style={{ color: "var(--red)", fontWeight: 600 }}>{error || "Job not found"}</p>
					<Link to="/jobs" className="btn btn-outline" style={{ marginTop: "1.5rem", display: "inline-flex" }}>
						← Back to Openings
					</Link>
				</div>
			</div>
		);
	}

	// ── Detail ───────────────────────────────────────────────────────────────
	const seoDesc = job
		? job.description.replace(/\s+/g, " ").trim().slice(0, 155) + (job.description.length > 155 ? "…" : "")
		: "View job details and apply instantly with AI-powered resume screening.";

	return (
		<div className="page" style={{ maxWidth: 820 }}>
			<Seo
				title={job ? job.title : "Job Details"}
				description={seoDesc}
				url={`https://hiresight.shashishanthan2706.workers.dev/jobs/${job_id}`}
			/>

			{/* Back navigation */}
			<Link
				to="/jobs"
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: ".4rem",
					fontSize: ".82rem",
					color: "var(--text-muted)",
					fontWeight: 500,
					marginBottom: "2rem",
					transition: "color 0.2s",
				}}
				onMouseEnter={e => (e.currentTarget.style.color = "var(--brand-light)")}
				onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
			>
				← All Openings
			</Link>

			{/* Header */}
			<div style={{ marginBottom: "2rem" }}>
				<h1 style={{
					fontSize: "clamp(1.75rem, 4vw, 2.4rem)",
					fontWeight: 700,
					letterSpacing: "-.02em",
					lineHeight: 1.2,
					marginBottom: "1rem",
					color: "var(--text-primary)",
				}}>
					{job.title}
				</h1>

				{/* Meta row */}
				<div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem", alignItems: "center" }}>
					<span className="job-meta-badge">📅 Posted {timeAgo(job.created_at)}</span>
					<span className="job-meta-badge">
						👥 {job.applicant_count} applicant{job.applicant_count !== 1 ? "s" : ""}
					</span>
					<span className="job-meta-badge" style={{ color: "var(--green)", borderColor: "var(--green-border)", background: "var(--green-bg)" }}>
						● Actively hiring
					</span>
				</div>
			</div>

			{/* Divider */}
			<div style={{ height: "1px", background: "var(--card-border)", marginBottom: "2rem" }} />

			{/* Description card */}
			<div className="card" style={{ marginBottom: "2rem" }}>
				<p className="section-label" style={{ marginBottom: "1.25rem" }}>About this role</p>
				<DescriptionRenderer text={job.description} />
			</div>

			{/* Apply CTA */}
			<div className="card" style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "1.5rem",
				flexWrap: "wrap",
				padding: "1.75rem 2rem",
				border: "1px solid rgba(193, 154, 94, 0.25)",
			}}>
				<div>
					<p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: ".25rem" }}>
						Ready to apply?
					</p>
					<p style={{ fontSize: ".83rem", color: "var(--text-muted)" }}>
						{isCandidate
							? "Upload your resume and get an AI match score in seconds."
							: "Create a candidate account to apply — it's free and takes a minute."}
					</p>
				</div>
				<button
					className="btn btn-primary"
					onClick={() => void handleApply()}
					style={{ whiteSpace: "nowrap", padding: ".9rem 2rem", fontSize: "1rem" }}
				>
					{isCandidate ? "Apply for this Role →" : "Sign in to Apply →"}
				</button>
			</div>

			{/* Footer hint */}
			<p style={{ marginTop: "1.25rem", fontSize: ".78rem", color: "var(--text-muted)", textAlign: "center" }}>
				Your resume is scored instantly by AI · Results are private to you
			</p>
		</div>
	);
}
