import { Link } from "react-router-dom";
import { FileCheck2 } from "lucide-react";

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
  applied: "Applied",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview: "Interview Scheduled",
  rejected: "Not Selected",
  hired: "Hired",
};

export default function AlreadyApplied({ job, result }: AlreadyAppliedProps) {
  return (
    <div className="page hr-page apply-page">
      <div className="hr-panel apply-gate">
        <span className="apply-gate-icon">
          <FileCheck2 size={22} />
        </span>
        <h2>You have already applied</h2>
        <p>
          Your application for <strong>{job?.title}</strong> is already on file.
        </p>
        {result.status && (
          <p>
            Status: <strong>{STATUS_LABEL[result.status] ?? result.status}</strong>
          </p>
        )}
        {result.score != null && (
          <p className="hr-muted">
            AI match score: <strong>{result.score}/100</strong>
            {result.reasoning ? ` — ${result.reasoning}` : ""}
          </p>
        )}
        <div className="apply-gate-actions">
          <Link to="/candidate/dashboard" className="btn btn-dark-pill">
            View my applications
          </Link>
          <Link to="/jobs" className="btn btn-secondary">
            Browse openings
          </Link>
        </div>
      </div>
    </div>
  );
}
