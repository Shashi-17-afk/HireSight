import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, Inbox, Search, Users, Sparkles, Building2 } from "lucide-react";
import Seo from "../components/Seo";
import { timeAgo } from "../lib/hr";
import MangoTrendingSection from "../components/MangoTrendingSection";

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
  const activeTab = params.get("tab") === "mango" ? "mango" : "all";

  function setSearch(value: string) {
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  function setTab(tab: "all" | "mango") {
    const next = new URLSearchParams(params);
    if (tab === "mango") next.set("tab", "mango");
    else next.delete("tab");
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
        title={activeTab === "mango" ? "🔥 MANGO & Trending Roles · HireSight" : "Browse Open Roles · HireSight"}
        description="Explore verified open positions and top-tier trending roles from Meta, Apple, Netflix, Google, OpenAI, Cloudflare, Stripe with AI match scoring."
      />

      <div className="jobs-hero">
        <span className="section-tag">Career Opportunities</span>
        <h1>
          Find your next <span className="pill-highlight pill-yellow">dream role</span>
        </h1>
        <p>
          Every role accepts instant AI-scored applications. Upload your resume and know your match fit in seconds.
        </p>

        {/* View Switcher Tabs: All Roles vs MANGO Only */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "rgba(0, 0, 0, 0.05)",
            padding: "0.3rem",
            borderRadius: "9999px",
            marginTop: "1.25rem",
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("all")}
            style={{
              padding: "0.45rem 1.15rem",
              borderRadius: "9999px",
              fontSize: "0.85rem",
              fontWeight: activeTab === "all" ? 700 : 500,
              background: activeTab === "all" ? "#18181b" : "transparent",
              color: activeTab === "all" ? "#fff" : "var(--text-primary)",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "all 0.15s ease",
            }}
          >
            <Building2 size={15} /> All Open Roles
          </button>

          <button
            type="button"
            onClick={() => setTab("mango")}
            style={{
              padding: "0.45rem 1.15rem",
              borderRadius: "9999px",
              fontSize: "0.85rem",
              fontWeight: activeTab === "mango" ? 700 : 500,
              background: activeTab === "mango" ? "linear-gradient(135deg, #ff6b00 0%, #ea580c 100%)" : "transparent",
              color: activeTab === "mango" ? "#fff" : "var(--text-primary)",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "all 0.15s ease",
            }}
          >
            <Sparkles size={15} /> 🔥 MANGO & Trending Roles Only
          </button>
        </div>

        {activeTab === "all" && (
          <div className="hr-search in-page jobs-hero-search" style={{ marginTop: "1.25rem" }}>
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles by job title or keyword..."
              aria-label="Search open roles"
            />
          </div>
        )}
      </div>

      {/* When MANGO Only is selected, render the dedicated MANGO & Trending Section */}
      {activeTab === "mango" ? (
        <MangoTrendingSection />
      ) : (
        <>
          {/* Spotlight Teaser for MANGO section */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(243, 128, 32, 0.08) 0%, rgba(99, 91, 255, 0.08) 100%)",
              border: "1px solid rgba(243, 128, 32, 0.25)",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "1.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.25rem" }}>🔥</span>
              <div>
                <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  Looking for Meta, Apple, Netflix, Google, OpenAI or Stripe roles?
                </strong>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Evaluate your resume fit with our instant AI Bar-Raiser match simulator.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTab("mango")}
              className="btn btn-sm"
              style={{
                background: "#18181b",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.8rem",
                borderRadius: "9999px",
                padding: "0.35rem 0.9rem",
              }}
            >
              Switch to MANGO Radar →
            </button>
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
        </>
      )}
    </div>
  );
}
