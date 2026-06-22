import { Link, Route, Routes, useLocation } from "react-router-dom";
import PostJob from "./pages/PostJob";
import Dashboard from "./pages/Dashboard";
import { lazy, Suspense } from "react";
const ApplyJob = lazy(() => import("./pages/ApplyJob"));

function Navbar() {
  const { pathname } = useLocation();
  const isDash = pathname.startsWith("/dashboard");
  const isApply = pathname.startsWith("/apply");
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo" style={{ textDecoration: "none" }}>
        <span className="nav-logo-icon">✨</span>
        Hire<span>Sight</span>
      </Link>
      <span className="nav-spacer" />
      {isDash && (
        <Link to="/" className="nav-link">+ Post a Job</Link>
      )}
      {isApply && (
        <span className="nav-link" style={{ color: "var(--gray-400)", cursor: "default" }}>
          Candidate Application
        </span>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<PostJob />} />
        <Route path="/dashboard/:job_id" element={<Dashboard />} />
        <Route
          path="/apply/:job_id"
          element={
            <Suspense fallback={<div className="page" style={{color:"var(--gray-400)"}}>Loading…</div>}>
              <ApplyJob />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
              <div style={{ fontSize: "3rem" }}>404</div>
              <p style={{ color: "var(--gray-600)", marginTop: ".5rem" }}>Page not found</p>
              <Link to="/" className="btn btn-primary" style={{ marginTop: "1.5rem", display: "inline-flex" }}>
                Go Home
              </Link>
            </div>
          }
        />
      </Routes>
    </>
  );
}
