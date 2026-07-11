interface ScoreResult {
  score: number | null;
  reasoning: string | null;
  alreadyApplied?: boolean;
  status?: string;
}

interface AlreadyAppliedProps {
  job: { title: string } | null;
  result: ScoreResult;
}

const STATUS_LABEL: Record<string, string> = {
  applied:      "Applied",
  under_review: "Under Review",
  shortlisted:  "Shortlisted",
  interview:    "Interview Scheduled",
  rejected:     "Not Selected",
  hired:        "Hired 🎉",
};

export default function AlreadyApplied({ job, result }: AlreadyAppliedProps) {
  return (
    <div className="page">
      <div className="card score-result-card">
        <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>📋</div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: ".5rem" }}>
          You've already applied
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", fontSize: ".9rem" }}>
          Your application for{" "}
          <strong style={{ color: "var(--text-primary)" }}>{job?.title}</strong> is already on file.
        </p>

        {result.status && (
          <p style={{ marginBottom: "1rem" }}>
            Status:{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {STATUS_LABEL[result.status] ?? result.status}
            </strong>
          </p>
        )}

        {result.score != null && (
          <p style={{ color: "var(--text-secondary)", fontSize: ".88rem", marginBottom: "1.5rem" }}>
            AI match score:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{result.score}/100</strong>
            {result.reasoning && ` — ${result.reasoning}`}
          </p>
        )}

        <a href="/candidate/dashboard" className="btn btn-primary" style={{ display: "inline-flex" }}>
          View My Applications →
        </a>
      </div>
    </div>
  );
}
