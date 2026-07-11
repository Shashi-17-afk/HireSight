import { Link } from "react-router-dom";

interface AuthGateProps {
  job: { title: string } | null;
  role: string | null;
  redirectParam: string;
}

export default function AuthGate({ job, role, redirectParam }: AuthGateProps) {
  return (
    <div
      className="page"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}
    >
      <div className="card" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ fontSize: "2.8rem", marginBottom: "1.25rem" }}>🔒</div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: ".75rem", letterSpacing: "-.01em" }}>
          Sign in to apply
        </h2>

        {job ? (
          <p style={{ color: "var(--text-secondary)", fontSize: ".92rem", marginBottom: "1.75rem", lineHeight: 1.65 }}>
            You need a candidate account to apply for{" "}
            <strong style={{ color: "var(--text-primary)" }}>{job.title}</strong>.
            It only takes a minute to get started.
          </p>
        ) : (
          <p style={{ color: "var(--text-secondary)", fontSize: ".92rem", marginBottom: "1.75rem" }}>
            You need a candidate account to apply for this role.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
          <Link
            to={`/login/candidate?redirect=${redirectParam}`}
            className="btn btn-primary btn-full"
            style={{ justifyContent: "center" }}
          >
            Sign in →
          </Link>
          <Link
            to={`/register/candidate?redirect=${redirectParam}`}
            className="btn btn-outline btn-full"
            style={{ justifyContent: "center" }}
          >
            Create a free account
          </Link>
        </div>

        {role === "HR" && (
          <p style={{ marginTop: "1.5rem", fontSize: ".8rem", color: "var(--text-muted)" }}>
            You're signed in as an HR user. Applications require a candidate account.
          </p>
        )}
      </div>
    </div>
  );
}
