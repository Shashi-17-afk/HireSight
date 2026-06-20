import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import HRDashboard from "./pages/HRDashboard";
import CandidateDashboard from "./pages/CandidateDashboard";
import { lazy, Suspense } from "react";

const ApplyJob = lazy(() => import("./pages/ApplyJob"));

function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    function checkAuth() {
      const token = localStorage.getItem("token");
      const name = localStorage.getItem("name");
      const role = localStorage.getItem("role");
      if (token && role && name) {
        setUser({ name, role });
      } else {
        setUser(null);
      }
    }
    checkAuth();
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  function handleLogout() {
    localStorage.clear();
    setUser(null);
    window.dispatchEvent(new Event("storage"));
    navigate("/");
  }

  const logoLink = user
    ? user.role === "HR"
      ? "/hr/dashboard"
      : "/candidate/dashboard"
    : "/";

  return (
    <nav className="nav">
      <Link to={logoLink} className="nav-logo" style={{ textDecoration: "none" }}>
        <span className="nav-logo-icon">✨</span>
        Hire<span>Sight</span>
      </Link>
      <span className="nav-spacer" />
      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: ".85rem", color: "var(--text-secondary)" }}>
            Hi, <strong>{user.name}</strong> ({user.role === "HR" ? "HR" : "Candidate"})
          </span>
          <button onClick={handleLogout} className="btn btn-outline" style={{ fontSize: ".8rem", padding: ".35rem .85rem" }}>
            Logout
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: ".5rem" }}>
          <Link to="/login/hr" className="nav-link" style={{ fontSize: ".8rem" }}>Recruiter Portal</Link>
          <Link to="/login/candidate" className="nav-link" style={{ fontSize: ".8rem" }}>Candidate Portal</Link>
        </div>
      )}
    </nav>
  );
}

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "HR" | "candidate" }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to={`/login/${allowedRole || "hr"}`} replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to={role === "HR" ? "/hr/dashboard" : "/candidate/dashboard"} replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (token) {
    if (role === "HR") return <Navigate to="/hr/dashboard" replace />;
    if (role === "candidate") return <Navigate to="/candidate/dashboard" replace />;
  }

  return (
    <div className="page" style={{ textAlign: "center", paddingTop: "2rem" }}>
      <div className="hero" style={{ padding: "3rem 1rem 2rem" }}>
        <div className="hero-badge">✦ Neural AI Resume Screening & Matching</div>
        <h1>Hire smarter with <span>HireSight</span></h1>
        <p>Post a job, share a link. Our AI scores every resume instantly and ranks candidates on a live leaderboard.</p>
      </div>

      <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", marginTop: "1rem" }}>
        <Link to="/login/hr" className="btn btn-primary" style={{ padding: "1rem 2rem" }}>
          Recruiter Portal →
        </Link>
        <Link to="/login/candidate" className="btn btn-outline" style={{ padding: "1rem 2rem" }}>
          Candidate Portal →
        </Link>
      </div>

      <div className="feature-pills" style={{ marginTop: "4rem" }}>
        <span className="pill">🧠 Neural AI Scoring</span>
        <span className="pill">⚡ Real-time Leaderboard</span>
        <span className="pill">🔗 Shareable Apply Links</span>
        <span className="pill">📄 Browser-side PDF Parsing</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<RootRedirect />} />

        {/* Authentication Pages */}
        <Route path="/login/hr" element={<AuthPage mode="login" role="hr" />} />
        <Route path="/login/candidate" element={<AuthPage mode="login" role="candidate" />} />
        <Route path="/register/hr" element={<AuthPage mode="register" role="hr" />} />
        <Route path="/register/candidate" element={<AuthPage mode="register" role="candidate" />} />

        {/* Protected HR Dashboard Routes */}
        <Route
          path="/hr/dashboard"
          element={
            <ProtectedRoute allowedRole="HR">
              <HRDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/:job_id"
          element={
            <ProtectedRoute allowedRole="HR">
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Candidate Dashboard Routes */}
        <Route
          path="/candidate/dashboard"
          element={
            <ProtectedRoute allowedRole="candidate">
              <CandidateDashboard />
            </ProtectedRoute>
          }
        />

        {/* Public Job Application Link (Anyone can apply) */}
        <Route
          path="/apply/:job_id"
          element={
            <Suspense fallback={<div className="page" style={{ color: "var(--gray-400)" }}>Loading…</div>}>
              <ApplyJob />
            </Suspense>
          }
        />

        {/* 404 Route */}
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
