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
      <h1 className="page-title">Post a Job</h1>
      <p className="page-sub">
        Paste your job description — our AI will score every applicant automatically.
      </p>

      <div className="card">
        {!result ? (
          <form onSubmit={(e) => void handleSubmit(e)}>
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
                placeholder="Paste the full job description here — skills, experience, responsibilities..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                required
              />
            </div>

            {error && (
              <p style={{ color: "var(--red)", fontSize: ".875rem", marginBottom: "1rem" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !title.trim() || !description.trim()}
            >
              {loading ? <><span className="spinner" /> Creating…</> : "Create Job & Generate Link"}
            </button>
          </form>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🎉</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{result.title}</div>
                <div style={{ fontSize: ".85rem", color: "var(--gray-600)" }}>
                  Job posted successfully — share the link with candidates
                </div>
              </div>
            </div>

            <div className="success-box">
              <h3>Candidate Apply Link</h3>
              <p style={{ fontSize: ".875rem", color: "var(--gray-600)" }}>
                Share this link so candidates can upload their resumes:
              </p>
              <div className="copy-link">
                <input readOnly value={applyLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button className="btn btn-outline" onClick={copyLink} type="button">
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
