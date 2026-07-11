import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CandidateData {
	application_id:   string | null;
	candidate_name:   string;
	candidate_email:  string;
	ai_score:         number;
	ai_reasoning:     string;
	status:           string | null;
	job_id:           string;
	job_title:        string;
	applied_at:       string;
	isAnonymous:      boolean;
	// Profile fields
	phone:            string | null;
	headline:         string | null;
	linkedin_url:     string | null;
	github_url:       string | null;
	portfolio_url:    string | null;
	resume_url:       string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE: string[] = [
	"applied", "under_review", "shortlisted", "interview", "hired",
];
const REJECTED = "rejected";

const STATUS_LABEL: Record<string, string> = {
	applied:      "Applied",
	under_review: "Under Review",
	shortlisted:  "Shortlisted",
	interview:    "Interview",
	rejected:     "Not Selected",
	hired:        "Hired 🎉",
};

const ALL_STATUSES = [...PIPELINE, REJECTED];

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreBadgeLarge(score: number) {
	const color = score >= 80 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";
	const label = score >= 80 ? "Strong Fit" : score >= 50 ? "Potential Match" : "Not a Match";
	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".25rem" }}>
			<span style={{ fontSize: "2.5rem", fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
			<span style={{ fontSize: ".72rem", color: "var(--text-muted)" }}>/ 100</span>
			<span style={{ fontSize: ".78rem", fontWeight: 700, color }}>{label}</span>
		</div>
	);
}

function ProfileLink({ href, label, icon }: { href: string; label: string; icon: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			style={{
				display: "inline-flex", alignItems: "center", gap: ".4rem",
				fontSize: ".82rem", color: "var(--brand-light)", fontWeight: 600,
				textDecoration: "none", padding: ".3rem .7rem",
				border: "1px solid rgba(99,102,241,.3)", borderRadius: "6px",
				background: "rgba(99,102,241,.08)",
			}}
		>
			{icon} {label} ↗
		</a>
	);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidateDetail() {
	const { submission_id } = useParams<{ submission_id: string }>();
	const [searchParams] = useSearchParams();
	const job_id = searchParams.get("job_id") ?? "";
	const navigate = useNavigate();

	const [data, setData]       = useState<CandidateData | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState("");

	const [selectedStatus, setSelectedStatus] = useState("");
	const [updating, setUpdating]   = useState(false);
	const [updateMsg, setUpdateMsg] = useState<{ ok: boolean; text: string } | null>(null);

	const token = localStorage.getItem("token") ?? "";

	useEffect(() => {
		if (!submission_id || !job_id) { setLoading(false); return; }

		fetch(`/api/applications/${submission_id}?job_id=${job_id}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((r) => r.json())
			.then((d: unknown) => {
				const raw = d as CandidateData & { error?: string };
				if (raw.error) { setLoadError(raw.error); return; }
				setData(raw);
				setSelectedStatus(raw.status ?? "applied");
			})
			.catch(() => setLoadError("Failed to load candidate data."))
			.finally(() => setLoading(false));
	}, [submission_id, job_id, token]);

	async function handleStatusUpdate() {
		if (!data?.application_id || !selectedStatus) return;
		setUpdating(true);
		setUpdateMsg(null);

		try {
			const res = await fetch(`/api/applications/${data.application_id}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ status: selectedStatus }),
			});
			const json = await res.json() as { status?: string; changed?: boolean; error?: string };
			if (!res.ok) throw new Error(json.error ?? "Update failed");

			setData((prev) => prev ? { ...prev, status: json.status ?? selectedStatus } : prev);
			setUpdateMsg({ ok: true, text: json.changed ? `Status updated to "${STATUS_LABEL[selectedStatus]}"` : "Status unchanged." });
		} catch (err) {
			setUpdateMsg({ ok: false, text: err instanceof Error ? err.message : "Update failed." });
		} finally {
			setUpdating(false);
		}
	}

	if (loading) return (
		<div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
			<span className="spinner" style={{ borderTopColor: "var(--brand)" }} />
			<p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>Loading candidate…</p>
		</div>
	);

	if (loadError || !data) return (
		<div className="page">
			<div className="card" style={{ textAlign: "center" }}>
				<p className="error-text">{loadError || "Candidate not found."}</p>
				<button className="btn btn-outline" style={{ marginTop: "1rem" }} onClick={() => navigate(-1)}>
					← Back
				</button>
			</div>
		</div>
	);

	const currentStatus = data.status;
	const pipelineIdx   = PIPELINE.indexOf(currentStatus ?? "");
	const isRejected    = currentStatus === REJECTED;

	return (
		<div className="page" style={{ maxWidth: 700 }}>

			{/* Back link */}
			<Link
				to={`/dashboard/${job_id}`}
				style={{ fontSize: ".82rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: ".3rem", marginBottom: "1.5rem" }}
			>
				← Back to Leaderboard
			</Link>

			{/* Header */}
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
				<div>
					<h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: ".25rem" }}>{data.candidate_name}</h1>
					<p style={{ fontSize: ".83rem", color: "var(--text-muted)", margin: 0 }}>{data.candidate_email}</p>
					{data.headline && (
						<p style={{ fontSize: ".88rem", color: "var(--text-secondary)", marginTop: ".35rem", fontStyle: "italic" }}>
							{data.headline}
						</p>
					)}
				</div>
				<div style={{ textAlign: "center" }}>{scoreBadgeLarge(data.ai_score)}</div>
			</div>

			{/* Anonymous note */}
			{data.isAnonymous && (
				<div className="profile-banner" style={{ marginBottom: "1.25rem" }}>
					<span className="profile-banner-icon">🔗</span>
					<div>
						<strong>External link application</strong>
						<p>This candidate applied via the public shareable link without an account. Status tracking is not available.</p>
					</div>
				</div>
			)}

			{/* Profile links row */}
			{(data.linkedin_url || data.github_url || data.portfolio_url || data.resume_url || data.phone) && (
				<div className="form-section" style={{ marginBottom: "1.25rem" }}>
					<div className="form-section-header">Contact &amp; Links</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem" }}>
						{data.phone && (
							<a href={`tel:${data.phone}`} style={{ fontSize: ".82rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: ".35rem" }}>
								📞 {data.phone}
							</a>
						)}
						{data.linkedin_url && <ProfileLink href={data.linkedin_url} label="LinkedIn" icon="💼" />}
						{data.github_url   && <ProfileLink href={data.github_url}   label="GitHub"   icon="🐙" />}
						{data.portfolio_url && <ProfileLink href={data.portfolio_url} label="Portfolio" icon="🌐" />}
						{data.resume_url   && <ProfileLink href={data.resume_url}   label="Resume"   icon="📄" />}
					</div>
				</div>
			)}

			{/* AI Reasoning */}
			<div className="form-section" style={{ marginBottom: "1.25rem" }}>
				<div className="form-section-header">🤖 AI Reasoning</div>
				<p style={{ fontSize: ".88rem", color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
					{data.ai_reasoning}
				</p>
			</div>

			{/* Status pipeline */}
			{!data.isAnonymous && data.application_id && (
				<div className="form-section">
					<div className="form-section-header">Application Status</div>

					{/* Visual pipeline */}
					<div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "1.5rem", flexWrap: "wrap", rowGap: ".5rem" }}>
						{PIPELINE.map((s, i) => {
							const isActive  = currentStatus === s;
							const isPast    = !isRejected && pipelineIdx > i;
							const isReject  = isRejected && s === "hired";
							return (
								<div key={s} style={{ display: "flex", alignItems: "center" }}>
									<div style={{
										padding: ".3rem .7rem",
										borderRadius: "999px",
										fontSize: ".72rem",
										fontWeight: 700,
										background: isReject ? "transparent"
											: isActive  ? "rgba(99,102,241,.2)"
											: isPast    ? "rgba(16,185,129,.1)"
											: "rgba(255,255,255,.04)",
										color: isReject ? "var(--text-muted)"
											: isActive  ? "#a5b4fc"
											: isPast    ? "#34d399"
											: "var(--text-muted)",
										border: `1px solid ${isActive ? "rgba(99,102,241,.5)" : isReject ? "transparent" : isPast ? "rgba(16,185,129,.3)" : "var(--border)"}`,
										whiteSpace: "nowrap",
									}}>
										{isPast ? "✓ " : ""}{STATUS_LABEL[s]}
									</div>
									{i < PIPELINE.length - 1 && (
										<div style={{ width: "1.5rem", height: "1px", background: isPast && !isRejected ? "#34d399" : "var(--border)", flexShrink: 0 }} />
									)}
								</div>
							);
						})}
						{/* Rejected badge shown separately */}
						{isRejected && (
							<span className="status-badge status-rejected" style={{ marginLeft: ".75rem" }}>
								Not Selected
							</span>
						)}
					</div>

					{/* Status control */}
					<div style={{ display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
						<select
							className="input"
							style={{ maxWidth: 220 }}
							value={selectedStatus}
							onChange={(e) => { setSelectedStatus(e.target.value); setUpdateMsg(null); }}
						>
							{ALL_STATUSES.map((s) => (
								<option key={s} value={s}>{STATUS_LABEL[s]}</option>
							))}
						</select>
						<button
							className="btn btn-primary"
							onClick={() => void handleStatusUpdate()}
							disabled={updating || selectedStatus === currentStatus}
							style={{ minWidth: 130 }}
						>
							{updating ? <><span className="spinner" /> Saving…</> : "Update Status"}
						</button>
					</div>

					{updateMsg && (
						<p style={{
							marginTop: ".75rem", fontSize: ".83rem", fontWeight: 600,
							color: updateMsg.ok ? "var(--success, #34d399)" : "var(--error, #f87171)",
						}}>
							{updateMsg.ok ? "✓" : "⚠"} {updateMsg.text}
						</p>
					)}
				</div>
			)}

		</div>
	);
}
