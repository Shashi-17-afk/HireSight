import { useEffect, useState } from "react";

interface Application {
  id: string;
  job_id: string;
  job_title: string;
  score: number;
  reasoning: string;
  created_at: string;
}

function scoreBadge(score: number) {
  if (score >= 80)
    return <span className="badge badge-green">{score} / 100</span>;
  if (score >= 50)
    return <span className="badge badge-yellow">{score} / 100</span>;
  return <span className="badge badge-red">{score} / 100</span>;
}

export default function CandidateDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const name = localStorage.getItem("name") || "Candidate";

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/candidates/my-applications", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load applications");
        return res.json() as Promise<Application[]>;
      })
      .then((data) => {
        setApplications(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error fetching applications");
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="page">
      <div className="dash-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 className="page-title">Candidate Application Portal</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Welcome, <strong style={{ color: "var(--text-primary)" }}>{name}</strong>. Track your job matches and AI feedback.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: "32px", height: "32px" }} />
          <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>Loading your applications...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>⚠️</div>
          <p style={{ color: "var(--red)" }}>{error}</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div className="empty-state-icon">📄</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>No applications submitted</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "340px", margin: ".5rem auto 1.5rem" }}>
            You haven't submitted any resumes yet. Use a public job application link from a recruiter to get started!
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {applications.map((app) => (
            <div key={app.id} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: ".5rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {app.job_title}
                  </h2>
                  <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
                    Applied on: {new Date(app.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>{scoreBadge(app.score)}</div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    marginBottom: ".4rem",
                  }}
                >
                  🤖 Neural AI Feedback
                </div>
                <p style={{ fontSize: ".875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {app.reasoning}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
