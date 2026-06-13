import { Link, Route, Routes, useLocation } from "react-router-dom";
import PostJob from "./pages/PostJob";
import Dashboard from "./pages/Dashboard";
import { lazy, Suspense } from "react";
const ApplyJob = lazy(() => import("./pages/ApplyJob"));

function Navbar() {
  const { pathname } = useLocation();
  const isDash = pathname.startsWith("/dashboard");
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        🤖 AI Hiring <span>Screener</span>
      </Link>
      {isDash && (
        <Link to="/" style={{ marginLeft: "auto", fontSize: ".875rem", color: "var(--gray-600)" }}>
          + Post a Job
        </Link>
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
