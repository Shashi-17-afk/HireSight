import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Copy, Check, ArrowRight, LogOut, Inbox, UserCheck, ExternalLink, Mail, Phone } from "lucide-react";
import Seo from "../components/Seo";

interface Job {
  id: string;
  title: string;
  description: string;
  created_at: string;
  applicant_count?: number;
}

interface HiredCandidate {
  application_id: string;
  user_id: string | null;
  status: string;
  hired_at: string;
  job_id: string;
  job_title: string;
  candidate_submission_id: string;
  candidate_name: string;
  candidate_email: string;
  ai_score: number | null;
  ai_reasoning: string | null;
  phone?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HRDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hiredList, setHiredList] = useState<HiredCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"jobs" | "hired">("jobs");
  
  const [showPostForm, setShowPostForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const token = localStorage.getItem("token");
  const userName = localStorage.getItem("name") || "Recruiter";

  function handleSignOut() {
    localStorage.clear();
    window.dispatchEvent(new Event("storage"));
    navigate("/");
  }

  function fetchJobsAndHired() {
    if (!token) return;
    setLoading(true);
    setError("");

    const fetchJobsReq = fetch("/api/jobs", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json() as Promise<{ jobs?: Job[] }>);

    const fetchHiredReq = fetch("/api/applications/hired", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json() as Promise<{ hired?: HiredCandidate[] }>);

    Promise.all([fetchJobsReq, fetchHiredReq])
      .then(([jobsData, hiredData]) => {
        setJobs(jobsData.jobs ?? []);
        setHiredList(hiredData.hired ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error loading dashboard data");
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchJobsAndHired();
  }, [token]);

  async function handlePostJob(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPostError("");
    setPostLoading(true);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create job");
      }

      setTitle("");
      setDescription("");
      setShowPostForm(false);
      fetchJobsAndHired();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPostLoading(false);
    }
  }

  function copyLink(jobId: string) {
    const applyLink = `${window.location.origin}/apply/${jobId}`;
    void navigator.clipboard.writeText(applyLink);
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const hiredCount = hiredList.filter((h) => h.status === "hired").length;
  const offeredCount = hiredList.filter((h) => h.status === "offered").length;

  return (
    <div className="page-wide">
      <Seo title="Recruiter Dashboard" description="Manage your HireSight job pipelines and view AI-ranked candidates." noIndex />

      {/* Header Banner */}
      <div className="card dash-card-header">
        <div>
          <span className="section-tag">Recruiter Workspace</span>
          <h1 className="dash-title">
            Welcome, <span className="pill-highlight pill-yellow">{userName}</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
            Manage active job postings, track hired candidates, and monitor real-time applicant leaderboards.
          </p>
        </div>
        <div className="dash-header-actions">
          <button
            onClick={() => setShowPostForm(!showPostForm)}
            className="btn btn-dark-pill btn-lg"
          >
            {showPostForm ? "✕ Close Form" : <><Plus size={18} /> Post a Job</>}
          </button>
          <button
            onClick={handleSignOut}
            className="btn btn-secondary btn-lg"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid-3" style={{ marginBottom: "2.5rem" }}>
        <div className="card-flat">
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Active Job Openings</div>
          <div className="metric-value">{jobs.length}</div>
        </div>
        <div className="card-flat">
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Candidates Hired</div>
          <div className="metric-value" style={{ color: "var(--status-green)" }}>
            {hiredCount}
          </div>
        </div>
        <div className="card-flat">
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Offers Extended</div>
          <div className="metric-value" style={{ color: "var(--status-blue)" }}>
            {offeredCount}
          </div>
        </div>
      </div>

      {/* Inline Post Job Form */}
      {showPostForm && (
        <div className="card" style={{ marginBottom: "2.5rem", border: "2px solid var(--pill-yellow)" }}>
          <h2 style={{ fontSize: "1.6rem", marginBottom: "1rem" }}>
            Publish New <span className="pill-highlight pill-pink">Job Role</span>
          </h2>
          <form onSubmit={(e) => void handlePostJob(e)}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                Job Role Title
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Senior Backend Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                Job Description
              </label>
              <textarea
                className="form-input"
                placeholder="Paste key responsibilities, required technical skills, and qualification criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                style={{ resize: "vertical" }}
                required
              />
            </div>

            {postError && (
              <p style={{ color: "var(--status-red)", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}>
                ⚠ {postError}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-dark-pill btn-lg"
              disabled={postLoading || !title.trim() || !description.trim()}
            >
              {postLoading ? "Creating job..." : <>Publish Job & Generate Apply Link <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>
      )}

      {/* Section Tabs */}
      <div className="tab-bar">
        <button
          type="button"
          onClick={() => setActiveTab("jobs")}
          className={`tab-bar-btn${activeTab === "jobs" ? " active" : ""}`}
        >
          Active Job Roles ({jobs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hired")}
          className={`tab-bar-btn${activeTab === "hired" ? " active" : ""}`}
        >
          Hired Talent Roster ({hiredList.length})
        </button>
      </div>

      {/* Tab 1: Active Job Roles */}
      {activeTab === "jobs" && (
        <div>
          {loading && (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.05rem" }}>Loading active job postings...</p>
            </div>
          )}

          {error && (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
              <p style={{ color: "var(--status-red)", fontWeight: 600, marginBottom: "1rem" }}>{error}</p>
              <button onClick={fetchJobsAndHired} className="btn btn-secondary btn-sm">Try Again</button>
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "3.5rem 2rem" }}>
              <Inbox size={44} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
              <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>No active job postings</h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                Create your first job role to generate a shareable apply link and start screening candidates with Workers AI.
              </p>
              <button onClick={() => setShowPostForm(true)} className="btn btn-dark-pill">
                <Plus size={18} /> Create Your First Job
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {jobs.map((j) => (
              <div key={j.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.3rem" }}>{j.title}</h3>
                    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      <span className="badge badge-blue">📅 Posted {timeAgo(j.created_at)}</span>
                      <span className="badge badge-green">⚡ Real-time Leaderboard</span>
                    </div>
                  </div>

                  <div className="dash-header-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyLink(j.id)}
                    >
                      {copiedId === j.id ? <><Check size={14} /> Link Copied</> : <><Copy size={14} /> Copy Apply Link</>}
                    </button>
                    <Link to={`/dashboard/${j.id}`} className="btn btn-dark-pill btn-sm">
                      View Live Leaderboard <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                <p style={{ color: "var(--text-secondary)", fontSize: "0.98rem", lineHeight: 1.6 }}>
                  {j.description.length > 200 ? j.description.slice(0, 200).trimEnd() + "..." : j.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Hired Talent Roster ("Whom you hired and for what role") */}
      {activeTab === "hired" && (
        <div>
          {loading && (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.05rem" }}>Loading hired talent roster...</p>
            </div>
          )}

          {!loading && hiredList.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <UserCheck size={48} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
              <h3 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>No candidates hired yet</h3>
              <p style={{ color: "var(--text-secondary)", maxWidth: "520px", margin: "0 auto 1.5rem" }}>
                When you review applicants on the live leaderboard and change their pipeline status to <strong>Hired</strong> or <strong>Offered</strong>, they will be showcased right here!
              </p>
              <button onClick={() => setActiveTab("jobs")} className="btn btn-dark-pill">
                View Open Leaderboards <ArrowRight size={16} />
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {hiredList.map((h) => (
              <div key={h.application_id} className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem" }}>
                      <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{h.candidate_name}</h3>
                      <span className={`badge ${h.status === "hired" ? "badge-green" : "badge-blue"}`}>
                        {h.status === "hired" ? "✓ Hired" : "✦ Offer Extended"}
                      </span>
                      {h.ai_score !== null && (
                        <span className="score-pill score-high">★ {h.ai_score} AI Fit</span>
                      )}
                    </div>

                    <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
                      Role: <span className="pill-highlight pill-yellow">{h.job_title}</span>
                    </div>

                    {h.headline && (
                      <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", fontStyle: "italic", marginBottom: "0.4rem" }}>
                        "{h.headline}"
                      </p>
                    )}
                  </div>

                  <div>
                    <Link
                      to={`/hr/candidate/${h.candidate_submission_id}?job_id=${h.job_id}`}
                      className="btn btn-dark-pill btn-sm"
                    >
                      View Candidate Detail <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Candidate Contact & Social Links Bar */}
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", paddingTop: "0.75rem", borderTop: "1px solid var(--card-border)", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    <Mail size={14} /> {h.candidate_email}
                  </span>
                  {h.phone && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                      <Phone size={14} /> {h.phone}
                    </span>
                  )}
                  {h.linkedin_url && (
                    <a href={h.linkedin_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      LinkedIn <ExternalLink size={12} />
                    </a>
                  )}
                  {h.github_url && (
                    <a href={h.github_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      GitHub <ExternalLink size={12} />
                    </a>
                  )}
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", width: "100%" }}>
                    Decision Date: {timeAgo(h.hired_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
