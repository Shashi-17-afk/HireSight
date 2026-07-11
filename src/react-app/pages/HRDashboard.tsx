import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface Job {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export default function HRDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Posting job state
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
      <div className="dash-header">
        <div>
          <h1 className="page-title">HR Recruiter Dashboard</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Welcome back, <strong style={{ color: "var(--text-primary)" }}>{userName}</strong>. Manage your job screener pipelines.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <button
            onClick={() => setShowPostForm(!showPostForm)}
            className="btn btn-primary"
            style={{ fontSize: ".875rem", padding: ".5rem 1.2rem" }}
          >
            {showPostForm ? "✕ Cancel" : "+ Post a Job"}
          </button>
          <button
            onClick={handleSignOut}
            className="btn btn-outline"
            style={{ fontSize: ".78rem", padding: ".5rem 1rem", color: "var(--text-muted)" }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {showPostForm && (
        <div className="card" style={{ marginBottom: "2rem", border: "1px solid var(--brand)" }}>
          <form onSubmit={(e) => void handlePostJob(e)}>
            <p className="section-label" style={{ fontWeight: 800, color: "var(--brand-light)", marginBottom: "1rem" }}>
              ✦ Publish New Job Posting
            </p>
            <div className="form-group">
              <label htmlFor="title">Job Title</label>
              <input
                id="title"
                type="text"
                placeholder="e.g. Senior Backend Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Job Description</label>
              <textarea
                id="description"
                placeholder="Paste job details, responsibilities, and skill requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                required
              />
            </div>

            {postError && <p className="error-text">⚠ {postError}</p>}

            <div style={{ display: "flex", gap: ".75rem", marginTop: ".5rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={postLoading || !title.trim() || !description.trim()}
              >
                {postLoading ? <span className="spinner" /> : "Publish Job →"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowPostForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: "32px", height: "32px" }} />
          <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>Loading your active jobs list...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>⚠️</div>
          <p style={{ color: "var(--red)" }}>{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "5rem 2rem" }}>
          <div className="empty-state-icon">💼</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>No jobs posted yet</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "340px", margin: ".5rem auto 1.5rem" }}>
            Create your first job posting to generate an apply link and launch the AI candidate screening leaderboard.
          </p>
          <button onClick={() => setShowPostForm(true)} className="btn btn-primary">
            + Post a Job Now
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {jobs.map((job) => (
            <div key={job.id} className="card-sm" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "between", alignItems: "start", width: "100%", flexWrap: "wrap", gap: ".5rem" }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>{job.title}</h2>
                  <p style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: ".15rem" }}>
                    Posted on: {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: "flex", gap: ".5rem" }}>
                  <Link to={`/dashboard/${job.id}`} className="btn btn-primary" style={{ fontSize: ".82rem", padding: ".4rem .9rem" }}>
                    Leaderboard 📊
                  </Link>
                </div>
              </div>

              <p style={{ fontSize: ".875rem", color: "var(--text-secondary)", lineClamp: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
                {job.description}
              </p>

              <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: ".85rem", display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)" }}>Apply Link:</span>
                <code style={{ fontSize: ".78rem", color: "var(--brand-light)", flex: 1, wordBreak: "break-all" }}>
                  {`${window.location.origin}/apply/${job.id}`}
                </code>
                <button
                  onClick={() => copyLink(job.id)}
                  className="btn btn-outline"
                  style={{ fontSize: ".78rem", padding: ".3rem .75rem" }}
                >
                  {copiedId === job.id ? "✓ Copied!" : "Copy Link"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
