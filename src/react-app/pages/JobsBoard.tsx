import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Search, ArrowRight } from "lucide-react";
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
	}, []);

	const filtered = jobs.filter((j) => j.title.toLowerCase().includes(search.toLowerCase()));

	return (
		<div className="page">
			<Seo
				title="Browse Open Roles"
				description="Explore all open positions on HireSight. Submit your resume and get instantly AI-scored and ranked."
			/>

			<div style={{ textAlign: "center", marginBottom: "3rem" }}>
				<span className="section-tag">Career Opportunities</span>
				<h1 style={{ fontSize: "2.8rem", margin: "0.5rem 0 1rem" }}>
					Find your next <span className="pill-highlight pill-yellow">dream role</span>
				</h1>
				<p style={{ color: "var(--text-secondary)", maxWidth: "580px", margin: "0 auto", fontSize: "1.1rem" }}>
					Every role accepts instant AI-scored applications. Upload your resume and know your match fit in seconds.
				</p>
			</div>

			{/* Search Input Bar */}
			<div style={{ position: "relative", maxWidth: "600px", margin: "0 auto 2.5rem" }}>
				<Search size={18} style={{ position: "absolute", left: "1.2rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
				<input
					type="text"
					className="form-input"
					style={{ paddingLeft: "3rem" }}
					placeholder="Search roles by job title or keyword..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			{loading && (
				<div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
					<p style={{ fontSize: "1.05rem" }}>Loading open roles...</p>
				</div>
			)}

			{error && (
				<div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
					<p style={{ color: "var(--status-red)", marginBottom: "1.25rem", fontWeight: 600 }}>{error}</p>
					<button onClick={loadJobs} className="btn btn-secondary btn-sm">
						Try Again
					</button>
				</div>
			)}

			{!loading && !error && filtered.length === 0 && (
				<div className="card" style={{ textAlign: "center", padding: "3.5rem 2rem" }}>
					<Inbox size={44} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
					<h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>
						{search ? "No roles match your search" : "No open roles yet"}
					</h3>
					<p style={{ color: "var(--text-secondary)" }}>
						{search ? "Try searching with a different keyword." : "Check back soon — new positions are added frequently."}
					</p>
				</div>
			)}

			<div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
				{filtered.map((job) => {
					const preview = job.description.length > 180
						? job.description.slice(0, 180).trimEnd() + "…"
						: job.description;

					return (
						<div key={job.id} className="card card-interactive" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
							<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
								<div>
									<h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.4rem" }}>{job.title}</h2>
									<div style={{ display: "flex", gap: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
										<span className="badge badge-blue">📅 {timeAgo(job.created_at)}</span>
										<span className="badge badge-green">👥 {job.applicant_count} applicant{job.applicant_count !== 1 ? "s" : ""}</span>
									</div>
								</div>
								<Link to={`/jobs/${job.id}`} className="btn btn-dark-pill btn-sm">
									View Details <ArrowRight size={14} />
								</Link>
							</div>
							<p style={{ color: "var(--text-secondary)", fontSize: "0.98rem", lineHeight: 1.6 }}>{preview}</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
