import { useEffect, useState, lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import AuthPage from "./pages/AuthPage";
import Seo from "./components/Seo";

const PostJob = lazy(() => import("./pages/PostJob"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ApplyJob = lazy(() => import("./pages/ApplyJob"));
const JobsBoard = lazy(() => import("./pages/JobsBoard"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const HRDashboard = lazy(() => import("./pages/HRDashboard"));
const CandidateDashboard = lazy(() => import("./pages/CandidateDashboard"));
const CandidateProfile = lazy(() => import("./pages/CandidateProfile"));
const CandidateDetail  = lazy(() => import("./pages/CandidateDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageFallback = <div className="page" style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: "4rem" }}>Loading…</div>;

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getAuth() {
	const token = localStorage.getItem("token");
	const role = localStorage.getItem("role");
	const name = localStorage.getItem("name");
	return token && role && name ? { token, role, name } : null;
}

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole: "HR" | "candidate" }) {
	const auth = getAuth();
	if (!auth) {
		return <Navigate to={`/login/${allowedRole === "HR" ? "hr" : "candidate"}`} replace />;
	}
	if (auth.role !== allowedRole) {
		return <Navigate to={auth.role === "HR" ? "/hr/dashboard" : "/candidate/dashboard"} replace />;
	}
	return <>{children}</>;
}

// ── Landing / root redirect ───────────────────────────────────────────────────

function RootRedirect() {
	const auth = getAuth();
	if (auth?.role === "HR") return <Navigate to="/hr/dashboard" replace />;
	if (auth?.role === "candidate") return <Navigate to="/candidate/dashboard" replace />;

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "HireSight",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web",
		offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
		description: "AI-powered resume screener that ranks candidates on a live leaderboard.",
		url: "https://hiresight.shashishanthan2706.workers.dev",
	};

	return (
		<div className="page" style={{ textAlign: "center", paddingTop: "1rem" }}>
			<Seo />
			<Helmet>
				<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
			</Helmet>
			<div className="hero">
				<h1>Hire smarter with <span>HireSight</span></h1>
				<p>Post a job, share a link. AI scores every resume instantly and ranks candidates on a live leaderboard.</p>
				<div className="feature-pills">
					<span className="pill">🧠 Neural AI Scoring</span>
					<span className="pill">⚡ Real-time Leaderboard</span>
					<span className="pill">🔗 Shareable Apply Links</span>
					<span className="pill">📄 Browser-side PDF Parsing</span>
				</div>
			</div>

			<div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "2rem" }}>
				<Link to="/login/hr" className="btn btn-primary" style={{ padding: "1rem 2rem", fontSize: "1rem" }}>
					Recruiter Portal →
				</Link>
				<Link to="/login/candidate" className="btn btn-outline" style={{ padding: "1rem 2rem", fontSize: "1rem" }}>
					Candidate Portal →
				</Link>
			</div>

			<p style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>
				Looking for open roles?{" "}
				<Link to="/jobs" style={{ fontWeight: 600, color: "var(--brand-light)" }}>Browse job listings →</Link>
			</p>
		</div>
	);
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
	const { pathname } = useLocation();
	const [user, setUser] = useState<{ name: string; role: string } | null>(null);

	useEffect(() => {
		function syncAuth() {
			const auth = getAuth();
			setUser(auth ? { name: auth.name, role: auth.role } : null);
		}
		syncAuth();
		window.addEventListener("storage", syncAuth);
		return () => window.removeEventListener("storage", syncAuth);
	}, []);

	const isApply = pathname.startsWith("/apply");

	return (
		<nav className="nav">
			<Link to="/" className="nav-logo" style={{ textDecoration: "none" }}>
				<span className="nav-logo-icon">✨</span>
				Hire<span>Sight</span>
			</Link>
			<span className="nav-spacer" />

			{user ? (
				<div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
					{user.role === "candidate" && (
						<Link to="/jobs" className="nav-link" style={{ fontSize: ".82rem" }}>Browse Openings</Link>
					)}
					{/* Name links to profile (candidates) or dashboard (HR) — logout lives there */}
					<Link
						to={user.role === "candidate" ? "/candidate/profile" : "/hr/dashboard"}
						className="nav-link"
						style={{ fontSize: ".83rem", fontWeight: 600 }}
					>
						{user.name}
						<span style={{ marginLeft: ".35rem", fontSize: ".7rem", opacity: .55, fontWeight: 400 }}>
							{user.role === "HR" ? "· Recruiter" : "· Candidate"}
						</span>
					</Link>
				</div>
			) : (
				<div style={{ display: "flex", gap: ".5rem" }}>
					{isApply ? (
						<Link to="/login/candidate" className="nav-link" style={{ fontSize: ".82rem" }}>Sign in</Link>
					) : (
						<>
							<Link to="/login/hr" className="nav-link" style={{ fontSize: ".82rem" }}>Recruiter</Link>
							<Link to="/login/candidate" className="nav-link" style={{ fontSize: ".82rem" }}>Candidate</Link>
						</>
					)}
				</div>
			)}
		</nav>
	);
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
	const year = new Date().getFullYear();
	return (
		<footer className="footer">
			<div className="footer-inner">
				<div className="footer-brand">
					<span className="footer-logo">Hire<span>Sight</span></span>
					<p>AI-powered hiring —<br />faster, fairer, smarter.</p>
				</div>
				<div className="footer-links">
					<div className="footer-col">
						<span className="footer-col-title">Product</span>
						<Link to="/jobs">Browse Openings</Link>
						<Link to="/login/hr">Post a Job</Link>
					</div>
					<div className="footer-col">
						<span className="footer-col-title">Portals</span>
						<Link to="/login/hr">Recruiter Sign In</Link>
						<Link to="/login/candidate">Candidate Sign In</Link>
						<Link to="/register/candidate">Create Account</Link>
					</div>
				</div>
			</div>
			<div className="footer-bottom">
				<span>© {year} HireSight. Built on Cloudflare Workers AI.</span>
			</div>
		</footer>
	);
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
	return (
		<>
			<Navbar />
			<Routes>

				{/* Landing / root redirect */}
				<Route path="/" element={<RootRedirect />} />

				{/* Auth pages (public) */}
				<Route path="/login/hr" element={<AuthPage mode="login" role="hr" />} />
				<Route path="/login/candidate" element={<AuthPage mode="login" role="candidate" />} />
				<Route path="/register/hr" element={<AuthPage mode="register" role="hr" />} />
				<Route path="/register/candidate" element={<AuthPage mode="register" role="candidate" />} />

				{/* HR-protected routes */}
				<Route
					path="/hr/dashboard"
					element={
						<ProtectedRoute allowedRole="HR">
							<Suspense fallback={PageFallback}><HRDashboard /></Suspense>
						</ProtectedRoute>
					}
				/>
				<Route
					path="/dashboard/:job_id"
					element={
						<ProtectedRoute allowedRole="HR">
							<Suspense fallback={PageFallback}><Dashboard /></Suspense>
						</ProtectedRoute>
					}
				/>
				{/* Legacy route kept for backwards-compat with shared dashboard links */}
				<Route
					path="/post-job"
					element={
						<ProtectedRoute allowedRole="HR">
							<Suspense fallback={PageFallback}><PostJob /></Suspense>
						</ProtectedRoute>
					}
				/>

			{/* HR candidate detail — keyed by candidates.id (leaderboard entry) */}
			<Route
				path="/hr/candidate/:submission_id"
				element={
					<ProtectedRoute allowedRole="HR">
						<Suspense fallback={PageFallback}><CandidateDetail /></Suspense>
					</ProtectedRoute>
				}
			/>

			{/* Candidate-protected routes */}
			<Route
				path="/candidate/dashboard"
				element={
					<ProtectedRoute allowedRole="candidate">
						<Suspense fallback={PageFallback}><CandidateDashboard /></Suspense>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/candidate/profile"
				element={
					<ProtectedRoute allowedRole="candidate">
						<Suspense fallback={PageFallback}><CandidateProfile /></Suspense>
					</ProtectedRoute>
				}
			/>

				{/* Public routes */}
				<Route
					path="/jobs"
					element={<Suspense fallback={PageFallback}><JobsBoard /></Suspense>}
				/>
				<Route
					path="/jobs/:job_id"
					element={<Suspense fallback={PageFallback}><JobDetail /></Suspense>}
				/>
				<Route
					path="/apply/:job_id"
					element={<Suspense fallback={PageFallback}><ApplyJob /></Suspense>}
				/>

				{/* 404 */}
				<Route
					path="*"
					element={<Suspense fallback={PageFallback}><NotFound /></Suspense>}
				/>
			</Routes>
			<Footer />
		</>
	);
}
