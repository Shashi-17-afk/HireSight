import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";

interface AuthGateProps {
  job: { title: string } | null;
  role: string | null;
  redirectParam: string;
}

export default function AuthGate({ job, role, redirectParam }: AuthGateProps) {
  return (
    <div className="page hr-page apply-page">
      <div className="hr-panel apply-gate">
        <span className="apply-gate-icon">
          <LockKeyhole size={22} />
        </span>
        <h2>Sign in to apply</h2>
        {job ? (
          <p>
            You need a candidate account to apply for <strong>{job.title}</strong>. It only takes a minute.
          </p>
        ) : (
          <p>You need a candidate account to apply for this role.</p>
        )}
        <div className="apply-gate-actions">
          <Link to={`/login/candidate?redirect=${redirectParam}`} className="btn btn-dark-pill">
            Sign in
          </Link>
          <Link to={`/register/candidate?redirect=${redirectParam}`} className="btn btn-outline">
            Create a free account
          </Link>
        </div>
        {role === "HR" && (
          <p className="hr-muted sm" style={{ marginTop: "1.25rem" }}>
            You are signed in as a recruiter. Applications require a candidate account.
          </p>
        )}
      </div>
    </div>
  );
}
