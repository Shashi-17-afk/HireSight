import { Link } from "react-router-dom";
import Seo from "../components/Seo";

function getAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const name = localStorage.getItem("name");
  return token && role && name ? { token, role, name } : null;
}

export default function NotFound() {
  const auth = getAuth();
  const dashLink =
    auth?.role === "HR" ? "/hr/dashboard" : auth?.role === "candidate" ? "/candidate/dashboard" : null;

  return (
    <div
      className="page"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}
    >
      <Seo title="Page Not Found" description="This page doesn't exist on HireSight." noIndex />

      <div
        className="card"
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          padding: "3rem 2.5rem",
          borderColor: "var(--card-border)",
        }}
      >
        {/* Gold decorative number */}
        <div
          style={{
            fontSize: "clamp(5rem, 18vw, 7.5rem)",
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--brand)",
            letterSpacing: "-0.04em",
            marginBottom: "1rem",
            opacity: 0.9,
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: ".6rem",
          }}
        >
          This page doesn't exist
        </h1>

        <p
          style={{
            color: "var(--text-muted)",
            fontSize: ".9rem",
            lineHeight: 1.65,
            marginBottom: "2rem",
            maxWidth: 320,
            margin: "0 auto 2rem",
          }}
        >
          It may have been moved, deleted, or the link might be wrong.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: ".75rem", alignItems: "center" }}>
          {dashLink ? (
            <Link to={dashLink} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              ← Go to Dashboard
            </Link>
          ) : (
            <Link to="/" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              ← Go Home
            </Link>
          )}
          {!auth && (
            <Link to="/jobs" className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>
              Browse Open Roles →
            </Link>
          )}
        </div>

        <p style={{ marginTop: "2rem", fontSize: ".75rem", color: "var(--text-muted)" }}>
          <Link to="/" style={{ color: "var(--brand-light)", fontWeight: 600 }}>HireSight</Link>
          {" "}— AI Resume Screening
        </p>
      </div>
    </div>
  );
}
