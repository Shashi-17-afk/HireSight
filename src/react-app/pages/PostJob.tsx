import { useState } from "react";
import { Link } from "react-router-dom";

export default function PostJob() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ job_id: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const applyLink = result
    ? `${window.location.origin}/apply/${result.job_id}`
    : "";

  const dashLink = result ? `/dashboard/${result.job_id}` : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create job");
      }
      const data = (await res.json()) as { job_id: string; title: string };
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    void navigator.clipboard.writeText(applyLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page">
      {!result && (
        <div className="hero">
          <div className="hero-badge">✦ Powered by Cloudflare Workers AI</div>
          <h1>Hire smarter with <span>AI screening</span></h1>
          <p>Post a job, share a link. Our AI scores every resume instantly and ranks candidates on a live leaderboard.</p>
          <div className="feature-pills">
            <span className="pill">🧠 Semantic AI Scoring</span>
            <span className="pill">⚡ Real-time Leaderboard</span>
            <span className="pill">🔗 Shareable Apply Links</span>
            <span className="pill">📄 PDF Resume Parsing</span>
          </div>
        </div>
      )}

      <div className="card">
        {!result ? (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <p className="section-label">New Job Posting</p>
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
                placeholder="Paste the full job description — required skills, experience level, responsibilities…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={9}
                required
              />
            </div>

            {error && (
              <p className="error-text">⚠ {error}</p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading || !title.trim() || !description.trim()}
            >
              {loading ? <><span className="spinner" /> Creating job…</> : "Create Job & Generate Apply Link →"}
            </button>
          </form>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: ".875rem", marginBottom: "1.25rem" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                border: "1.5px solid #86efac",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.35rem"
              }}>🎉</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-.01em" }}>{result.title}</div>
                <div style={{ fontSize: ".83rem", color: "var(--gray-500)", marginTop: ".1rem" }}>
                  Job posted — share the apply link with candidates
                </div>
              </div>
            </div>

            <div className="success-box">
              <h3>Candidate Apply Link</h3>
              <p style={{ fontSize: ".83rem", color: "var(--gray-600)", marginBottom: ".25rem" }}>
                Anyone with this link can upload their resume and get an AI score instantly.
              </p>
              <div className="copy-link">
                <input readOnly value={applyLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button className="btn btn-outline" onClick={copyLink} type="button" style={{ flexShrink: 0 }}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
              <Link to={dashLink} className="btn btn-primary">
                View Live Leaderboard →
              </Link>
              <button
                className="btn btn-outline"
                onClick={() => { setResult(null); setTitle(""); setDescription(""); }}
                type="button"
              >
                Post Another Job
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
