import { useEffect, useState, lazy, Suspense } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import AuthPage from "./pages/AuthPage";
import HRLayout from "./components/HRLayout";
import CandidateLayout from "./components/CandidateLayout";
import HelpChat from "./components/HelpChat";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ApplyJob = lazy(() => import("./pages/ApplyJob"));
const JobsBoard = lazy(() => import("./pages/JobsBoard"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const HRDashboard = lazy(() => import("./pages/HRDashboard"));
const JobRequisitions = lazy(() => import("./pages/JobRequisitions"));
const JobDescriptionCreator = lazy(() => import("./pages/JobDescriptionCreator"));
const CandidatesList = lazy(() => import("./pages/CandidatesList"));
const CandidateDashboard = lazy(() => import("./pages/CandidateDashboard"));
const CandidateProfile = lazy(() => import("./pages/CandidateProfile"));
const CandidateDetail  = lazy(() => import("./pages/CandidateDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));

const PageFallback = <div className="page" style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: "4rem" }}>Loading…</div>;

function isTokenValid(token: string | null): boolean {
	if (!token) return false;
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return false;
		const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
		if (payload.exp && typeof payload.exp === "number") {
			if (Date.now() / 1000 >= payload.exp) {
				return false;
			}
		}
		return true;
	} catch {
		return false;
	}
}

function getAuth() {
	const token = localStorage.getItem("token");
	const role = localStorage.getItem("role");
	const name = localStorage.getItem("name");
	if (token && role && name && isTokenValid(token)) {
		return { token, role, name };
	}
	if (token && !isTokenValid(token)) {
		localStorage.clear();
		window.dispatchEvent(new Event("storage"));
	}
	return null;
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

function signOut() {
	localStorage.clear();
	window.dispatchEvent(new Event("storage"));
}

// ── Navbar ────────────────────────────────────────────────────────────────────

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const [user, setUser] = useState<{ name: string; role: string } | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		function syncAuth() {
			const auth = getAuth();
			setUser(auth ? { name: auth.name, role: auth.role } : null);
		}
		syncAuth();
		window.addEventListener("storage", syncAuth);
		return () => window.removeEventListener("storage", syncAuth);
	}, []);

	useEffect(() => {
		setMenuOpen(false);
	}, [pathname]);

	const isApply = pathname.startsWith("/apply");
	const dashboardPath = user?.role === "candidate" ? "/candidate/dashboard" : "/hr/dashboard";
	const profilePath = user?.role === "candidate" ? "/candidate/profile" : "/hr/dashboard";

	function handleSignOut() {
		signOut();
		setMenuOpen(false);
		navigate("/");
	}

	return (
		<nav className={`nav${menuOpen ? " nav--open" : ""}`}>
			<Link to="/" className="nav-logo">
				HireSight<span className="nav-logo-dot" />
			</Link>

			<div className="nav-links-landing">
				<a href="/#features" className="nav-link">Features</a>
				<a href="/#how-it-works" className="nav-link">How it works</a>
				<a href="/#pricing" className="nav-link">Pricing</a>
				<a href="/#faq" className="nav-link">FAQ</a>
			</div>

			<span className="nav-spacer" />

			{user ? (
				<div className="nav-actions nav-actions--auth">
					<Link to={dashboardPath} className="nav-link nav-link--bold">
						Dashboard
					</Link>
					{user.role === "candidate" ? (
						<Link to="/jobs" className="btn btn-secondary btn-sm">Browse Openings</Link>
					) : (
						<Link to="/hr/jobs/new" className="btn btn-secondary btn-sm">Post Job</Link>
					)}
					<Link to={profilePath} className="nav-user-badge">
						<span>{user.name}</span>
						<span className="nav-user-role">
							{user.role === "HR" ? "Recruiter" : "Candidate"}
						</span>
					</Link>
					<button type="button" onClick={handleSignOut} className="nav-signout">
						Sign out
					</button>
				</div>
			) : (
				<div className="nav-actions">
					{isApply ? (
						<Link to="/login/candidate" className="btn btn-dark-pill btn-sm">Sign in</Link>
					) : (
						<>
							<Link to="/login/hr" className="btn btn-outline btn-sm nav-btn-recruiter">Recruiter</Link>
							<Link to="/login/candidate" className="btn btn-dark-pill btn-sm">Candidate</Link>
						</>
					)}
				</div>
			)}

			<button
				type="button"
				className="nav-menu-toggle"
				onClick={() => setMenuOpen((open) => !open)}
				aria-expanded={menuOpen}
				aria-label={menuOpen ? "Close menu" : "Open menu"}
			>
				{menuOpen ? <X size={22} /> : <Menu size={22} />}
			</button>

			{menuOpen && (
				<div className="nav-mobile-menu">
					{user ? (
						<>
							<div className="nav-mobile-user">
								<span className="nav-mobile-name">{user.name}</span>
								<span className="nav-mobile-role">
									{user.role === "HR" ? "Recruiter" : "Candidate"}
								</span>
							</div>
							<Link to={dashboardPath} className="nav-mobile-link">Dashboard</Link>
							{user.role === "candidate" ? (
								<>
									<Link to="/jobs" className="nav-mobile-link">Browse Openings</Link>
									<Link to="/candidate/profile" className="nav-mobile-link">Edit Profile</Link>
								</>
							) : (
								<Link to="/hr/jobs/new" className="nav-mobile-link">Post a Job</Link>
							)}
							<button type="button" onClick={handleSignOut} className="nav-mobile-signout">
								Sign out
							</button>
						</>
					) : (
						<>
							<a href="/#features" className="nav-mobile-link">Features</a>
							<a href="/#how-it-works" className="nav-mobile-link">How it works</a>
							<a href="/#pricing" className="nav-mobile-link">Pricing</a>
							<a href="/#faq" className="nav-mobile-link">FAQ</a>
							<div className="nav-mobile-auth">
								{isApply ? (
									<Link to="/login/candidate" className="btn btn-dark-pill btn-sm">Sign in</Link>
								) : (
									<>
										<Link to="/login/hr" className="btn btn-outline btn-sm">Recruiter</Link>
										<Link to="/login/candidate" className="btn btn-dark-pill btn-sm">Candidate</Link>
									</>
								)}
							</div>
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
					<span className="footer-logo">
						HireSight<span className="nav-logo-dot" style={{ marginLeft: "4px" }} />
					</span>
					<p>AI-powered recruitment —<br />faster, fairer, smarter hiring.</p>
				</div>
				<div className="footer-col">
					<span className="footer-col-title">Product</span>
					<Link to="/jobs">Browse Openings</Link>
					<Link to="/register/hr">Post a Job</Link>
					<a href="/#features">Features</a>
					<a href="/#pricing">Pricing</a>
				</div>
				<div className="footer-col">
					<span className="footer-col-title">Portals</span>
					<Link to="/login/hr">Recruiter Sign In</Link>
					<Link to="/login/candidate">Candidate Sign In</Link>
					<Link to="/register/candidate">Create Account</Link>
				</div>
				<div className="footer-col">
					<span className="footer-col-title">Support</span>
					<a href="/#faq">FAQ</a>
					<a href="/#how-it-works">How it works</a>
					<a href="mailto:hello@hiresight.app">Contact Us</a>
				</div>
			</div>
			<div className="footer-bottom">
				<span>© {year} HireSight. Built on Cloudflare Workers AI.</span>
				<span>Designed for modern hiring teams</span>
			</div>
		</footer>
	);
}

// ── App ───────────────────────────────────────────────────────────────────────

function isHrWorkspace(pathname: string) {
	return pathname.startsWith("/hr") || pathname.startsWith("/dashboard/") || pathname === "/post-job";
}

function isJobsBrowsePath(pathname: string) {
	return pathname.startsWith("/jobs") || pathname.startsWith("/apply");
}

function isCandidateWorkspace(pathname: string) {
	if (pathname.startsWith("/candidate")) return true;
	const auth = getAuth();
	return !!auth && auth.role === "candidate" && isJobsBrowsePath(pathname);
}

function OptionalCandidateShell() {
	const auth = getAuth();
	if (auth?.role === "candidate") {
		return (
			<ProtectedRoute allowedRole="candidate">
				<CandidateLayout />
			</ProtectedRoute>
		);
	}
	return <Outlet />;
}

function HrWorkspace() {
	return (
		<ProtectedRoute allowedRole="HR">
			<HRLayout />
		</ProtectedRoute>
	);
}

function CandidateWorkspace() {
	return (
		<ProtectedRoute allowedRole="candidate">
			<CandidateLayout />
		</ProtectedRoute>
	);
}

function HrPage({ children }: { children: React.ReactNode }) {
	return <Suspense fallback={PageFallback}>{children}</Suspense>;
}

export default function App() {
	const { pathname } = useLocation();
	const [, setAuthTick] = useState(0);

	useEffect(() => {
		function syncAuth() {
			setAuthTick((n) => n + 1);
		}
		window.addEventListener("storage", syncAuth);
		return () => window.removeEventListener("storage", syncAuth);
	}, []);

	const hideChrome = isHrWorkspace(pathname) || isCandidateWorkspace(pathname);

	return (
		<>
			{!hideChrome && <Navbar />}
			<Routes>
				<Route path="/" element={<Suspense fallback={PageFallback}><HomePage /></Suspense>} />

				<Route path="/login/hr" element={<AuthPage mode="login" role="hr" />} />
				<Route path="/login/candidate" element={<AuthPage mode="login" role="candidate" />} />
				<Route path="/register/hr" element={<AuthPage mode="register" role="hr" />} />
				<Route path="/register/candidate" element={<AuthPage mode="register" role="candidate" />} />
				<Route path="/forgot-password" element={<Suspense fallback={PageFallback}><ForgotPasswordPage /></Suspense>} />
				<Route path="/reset-password" element={<Suspense fallback={PageFallback}><ForgotPasswordPage /></Suspense>} />

				<Route element={<HrWorkspace />}>
					<Route path="/hr/dashboard" element={<HrPage><HRDashboard /></HrPage>} />
					<Route path="/hr/jobs" element={<HrPage><JobRequisitions /></HrPage>} />
					<Route path="/hr/jobs/new" element={<HrPage><JobDescriptionCreator /></HrPage>} />
					<Route path="/hr/candidates" element={<HrPage><CandidatesList /></HrPage>} />
					<Route path="/hr/candidate/:submission_id" element={<HrPage><CandidateDetail /></HrPage>} />
					<Route path="/dashboard/:job_id" element={<HrPage><Dashboard /></HrPage>} />
					<Route path="/post-job" element={<Navigate to="/hr/jobs/new" replace />} />
				</Route>

				<Route element={<CandidateWorkspace />}>
					<Route path="/candidate/dashboard" element={<HrPage><CandidateDashboard /></HrPage>} />
					<Route path="/candidate/profile" element={<HrPage><CandidateProfile /></HrPage>} />
				</Route>

				<Route element={<OptionalCandidateShell />}>
					<Route path="/jobs" element={<Suspense fallback={PageFallback}><JobsBoard /></Suspense>} />
					<Route path="/jobs/:job_id" element={<Suspense fallback={PageFallback}><JobDetail /></Suspense>} />
					<Route path="/apply/:job_id" element={<Suspense fallback={PageFallback}><ApplyJob /></Suspense>} />
				</Route>

				<Route path="*" element={<Suspense fallback={PageFallback}><NotFound /></Suspense>} />
			</Routes>
			{!hideChrome && <Footer />}
			<HelpChat />
		</>
	);
}
