interface ScoreResultData {
  score: number | null;
  reasoning: string | null;
}

interface ScoreResultProps {
  result: ScoreResultData;
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong Fit ✓";
  if (score >= 50) return "Potential Match";
  return "Not a Match";
}

export default function ScoreResult({ result }: ScoreResultProps) {
  const score  = result.score ?? 0;
  const radius = 72;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  const fillClass =
    score >= 80 ? "score-circle-fill-green"
    : score >= 50 ? "score-circle-fill-yellow"
    : "score-circle-fill-red";

  const scoreColor =
    score >= 80 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";

  return (
    <div className="page">
      <div className="card score-result-card">
        <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>
          {score >= 80 ? "🎉" : score >= 50 ? "🤔" : "😔"}
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", letterSpacing: "-.02em" }}>
          Your AI Match Score
        </h2>

        <div className="score-circle-wrap">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle className="score-circle-bg" cx="90" cy="90" r={radius} strokeWidth="10" />
            <circle
              className={`score-circle-fill ${fillClass}`}
              cx="90" cy="90" r={radius}
              strokeWidth="10"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="score-circle-text">
            <span className="score-number" style={{ color: scoreColor }}>{score}</span>
            <span className="score-denom">/ 100</span>
          </div>
        </div>

        <p className="score-label-text" style={{ color: scoreColor }}>{scoreLabel(score)}</p>
        <p style={{
          color: "var(--text-secondary)", fontSize: ".93rem", lineHeight: 1.65,
          maxWidth: "480px", margin: "0 auto 1.5rem",
        }}>
          {result.reasoning}
        </p>
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
          Application submitted. The hiring team will review your profile.
        </p>
      </div>
    </div>
  );
}
