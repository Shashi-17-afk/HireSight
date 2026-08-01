import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Copy, Check, ArrowRight, LogOut, Inbox } from "lucide-react";
import Seo from "../components/Seo";

interface Job {
  id: string;
  title: string;
  description: string;
  created_at: string;
  applicant_count?: number;
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

export default function HRDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
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

  function fetchJobs() {
    if (!token) return;
    setLoading(true);
    fetch("/api/jobs", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load jobs");
        return res.json() as Promise<{ jobs: Job[] }>;
      })
      .then((data) => {
        setJobs(data.jobs ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error fetching jobs");
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchJobs();
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
      fetchJobs();
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

  return (
    <div className="page-wide">
      <Seo title="Recruiter Dashboard" description="Manage your HireSight job pipelines and view AI-ranked candidates." noIndex />

      {/* Header Banner */}
      <div className="card" style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
        <div>
          <span className="section-tag">Recruiter Workspace</span>
          <h1 style={{ fontSize: "2.4rem", margin: "0.4rem 0" }}>
            Welcome, <span className="pill-highlight pill-yellow">{userName}</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
            Manage active job postings, monitor real-time candidate leaderboards, and copy apply links.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
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

      {/* Jobs Pipeline Section */}
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "1.8rem" }}>
          Active <span className="pill-highlight pill-green">Job Pipelines</span> ({jobs.length})
        </h2>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
          <p style={{ fontSize: "1.05rem" }}>Loading active job postings...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
          <p style={{ color: "var(--status-red)", fontWeight: 600, marginBottom: "1rem" }}>{error}</p>
          <button onClick={fetchJobs} className="btn btn-secondary btn-sm">Try Again</button>
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

              <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
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
  );
}
