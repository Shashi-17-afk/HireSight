import { Link, Route, Routes, useLocation } from "react-router-dom";
import PostJob from "./pages/PostJob";
import Dashboard from "./pages/Dashboard";
import { lazy, Suspense } from "react";
const ApplyJob = lazy(() => import("./pages/ApplyJob"));
const JobsBoard = lazy(() => import("./pages/JobsBoard"));

const PageFallback = <div className="page" style={{ color: "var(--gray-400)" }}>Loading…</div>;

function Navbar() {
  const { pathname } = useLocation();
  const isDash = pathname.startsWith("/dashboard");
  const isApply = pathname.startsWith("/apply");
  const isJobs = pathname === "/jobs";
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
        <Link to="/jobs" className="nav-link">← All Roles</Link>
      )}
      {!isDash && !isApply && !isJobs && (
        <Link to="/jobs" className="nav-link">Browse Roles</Link>
      )}
      {isJobs && (
        <Link to="/" className="nav-link">+ Post a Job</Link>
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
        <Route
          path="/jobs"
          element={
            <Suspense fallback={PageFallback}>
              <JobsBoard />
            </Suspense>
          }
        />
        <Route path="/dashboard/:job_id" element={<Dashboard />} />
        <Route
          path="/apply/:job_id"
          element={
            <Suspense fallback={PageFallback}>
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
