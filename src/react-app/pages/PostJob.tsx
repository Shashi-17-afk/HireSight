import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ArrowRight, PlusCircle } from "lucide-react";
import Seo from "../components/Seo";

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
      const token = localStorage.getItem("token") ?? "";
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
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
    <div className="page" style={{ maxWidth: 740 }}>
      <Seo title="Post a New Job Role" description="Create a job posting and generate an instant AI resume screening apply link." noIndex />

      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <span className="section-tag">Recruiter Workspace</span>
        <h1 style={{ fontSize: "2.6rem", margin: "0.5rem 0" }}>
          Publish a <span className="pill-highlight pill-yellow">Job Opening</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
          Define the job title and requirements. Workers AI will score and rank every applicant resume on a live leaderboard.
        </p>
      </div>

      <div className="card">
        {!result ? (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                Job Role Title
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Senior Full-Stack Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: "1.75rem" }}>
              <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                Job Description & Criteria
              </label>
              <textarea
                className="form-input"
                placeholder="Paste the job description — key technical skills, experience requirements, responsibilities..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                style={{ resize: "vertical" }}
                required
              />
            </div>

            {error && (
              <p style={{ color: "var(--status-red)", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}>
                ⚠ {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-dark-pill btn-lg"
              style={{ width: "100%" }}
              disabled={loading || !title.trim() || !description.trim()}
            >
              {loading ? (
                "Publishing job role..."
              ) : (
                <>Create Job & Generate Apply Link <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "var(--status-green-bg)", color: "var(--status-green)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.8rem", margin: "0 auto 1.25rem"
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{result.title}</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
              Job successfully created! Share this unique apply link with candidates:
            </p>

            <div style={{ background: "var(--card-bg-alt)", padding: "1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", marginBottom: "2rem" }}>
              <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", textAlign: "left" }}>
                Shareable Candidate Apply Link
              </label>
              <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  className="form-input"
                  value={applyLink}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button className="btn btn-dark-pill" onClick={copyLink} type="button" style={{ flexShrink: 0 }}>
                  {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link to={dashLink} className="btn btn-dark-pill btn-lg">
                View Live Leaderboard <ArrowRight size={18} />
              </Link>
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => { setResult(null); setTitle(""); setDescription(""); }}
                type="button"
              >
                <PlusCircle size={18} /> Post Another Job
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
