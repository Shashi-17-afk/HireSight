import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";

interface Job {
	id: string;
	title: string;
	description: string;
	created_at: string;
	applicant_count: number;
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

export default function JobsBoard() {
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");

	function loadJobs() {
		setLoading(true);
		setError("");
		fetch("/api/jobs")
			.then((r) => r.json())
			.then((data: unknown) => {
				const d = data as { jobs?: Job[]; error?: string };
				if (d.error) setError(d.error);
				else setJobs(d.jobs ?? []);
			})
			.catch(() => setError("Could not load jobs. Please try again."))
			.finally(() => setLoading(false));
	}

	useEffect(() => {
		loadJobs();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const filtered = jobs.filter((j) => j.title.toLowerCase().includes(search.toLowerCase()));

	return (
		<div className="page">
			<Seo
				title="Browse Open Roles"
				description="Explore all open positions on HireSight. Submit your resume and get instantly AI-scored and ranked."
			/>
			<div className="hero" style={{ paddingBottom: "2rem" }}>
				<h1>Find your next <span>opportunity</span></h1>
				<p>Every role accepts instant AI-scored applications. Upload your resume and know your fit in seconds.</p>
			</div>

			<div className="search-input-wrap" style={{ marginBottom: "1.5rem" }}>
				<input
					type="text"
					placeholder="Search roles by title…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			{loading && (
				<div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
					<span className="spinner" style={{ borderTopColor: "var(--brand)" }} />
					<p style={{ marginTop: "1rem", fontSize: ".9rem" }}>Loading open roles…</p>
				</div>
			)}

		{error && (
			<div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
				<div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>⚠️</div>
				<p style={{ color: "var(--red)", marginBottom: "1.25rem" }}>{error}</p>
				<button onClick={loadJobs} className="btn btn-outline" style={{ fontSize: ".85rem" }}>
					Try Again
				</button>
			</div>
		)}

			{!loading && !error && filtered.length === 0 && (
				<div className="card">
					<div className="empty-state">
						<div className="empty-state-icon">{search ? "🔍" : "📭"}</div>
						<p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: ".95rem" }}>
							{search ? "No roles match your search" : "No open roles yet"}
						</p>
						<p style={{ color: "var(--text-secondary)" }}>
							{search ? "Try a different keyword." : "Check back soon — new roles are posted regularly."}
						</p>
					</div>
				</div>
			)}

			<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
				{filtered.map((job) => {
					const preview = job.description.length > 180
						? job.description.slice(0, 180).trimEnd() + "…"
						: job.description;

					return (
						<div key={job.id} className="job-card">
					<div className="job-card-top">
							<div style={{ flex: 1, minWidth: 0 }}>
								<h2 className="job-title">{job.title}</h2>
								<div className="job-meta">
									<span className="job-meta-badge">📅 {timeAgo(job.created_at)}</span>
									<span className="job-meta-badge">👥 {job.applicant_count} applicant{job.applicant_count !== 1 ? "s" : ""}</span>
								</div>
							</div>
							<Link
								to={`/jobs/${job.id}`}
								className="btn btn-outline"
								style={{ whiteSpace: "nowrap", flexShrink: 0, fontSize: ".85rem" }}
							>
								View Details →
							</Link>
						</div>
						<p className="job-description-preview">{preview}</p>
						</div>
					);
				})}
			</div>

			{!loading && !error && filtered.length > 0 && (
				<p style={{ textAlign: "center", marginTop: "2rem", fontSize: ".8rem", color: "var(--text-muted)" }}>
					{filtered.length} open role{filtered.length !== 1 ? "s" : ""} · AI-scored applications
				</p>
			)}
		</div>
	);
}
