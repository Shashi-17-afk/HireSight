import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, Inbox, Search, Users } from "lucide-react";
import Seo from "../components/Seo";
import { timeAgo } from "../lib/hr";

interface Job {
  id: string;
  title: string;
  description: string;
  created_at: string;
  applicant_count: number;
  status?: string;
}

function excerpt(text: string, max = 160) {
  const clean = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

export default function JobsBoard() {
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const search = params.get("q") ?? "";

  function setSearch(value: string) {
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(needle) ||
        j.description.toLowerCase().includes(needle)
    );
  }, [jobs, search]);

  return (
    <div className="page hr-page jobs-board">
      <Seo
        title="Browse Open Roles"
        description="Explore all open positions on HireSight. Submit your resume and get instantly AI-scored and ranked."
      />

      <div className="jobs-hero">
        <span className="section-tag">Career Opportunities</span>
        <h1>
          Find your next <span className="pill-highlight pill-yellow">dream role</span>
        </h1>
        <p>
          Every role accepts instant AI-scored applications. Upload your resume and know your match fit in seconds.
        </p>
        <div className="hr-search in-page jobs-hero-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles by job title or keyword..."
            aria-label="Search open roles"
          />
        </div>
      </div>

      {error && (
        <div className="hr-banner-error">
          {error}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadJobs}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="hr-empty-block">Loading open roles…</div>
      ) : filtered.length === 0 ? (
        <div className="hr-empty-block">
          <Inbox size={40} />
          <h3>{search ? "No roles match your search" : "No open roles yet"}</h3>
          <p>
            {search
              ? "Try a different keyword, or clear search to see every opening."
              : "Check back soon — new positions are added frequently."}
          </p>
        </div>
      ) : (
        <div className="jobs-list">
          {filtered.map((job) => (
            <Link to={`/jobs/${job.id}`} key={job.id} className="job-row">
              <div className="job-row-main">
                <div className="job-row-title-line">
                  <h3>{job.title}</h3>
                  <span className="badge badge-green">Open</span>
                </div>
                <p>{excerpt(job.description)}</p>
                <div className="job-row-meta">
                  <span>
                    <Clock3 size={13} />
                    {timeAgo(job.created_at)}
                  </span>
                  <span>
                    <Users size={13} />
                    {job.applicant_count ?? 0}{" "}
                    {(job.applicant_count ?? 0) === 1 ? "applicant" : "applicants"}
                  </span>
                </div>
              </div>
              <span className="btn btn-dark-pill btn-sm job-row-cta">
                View role <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
