import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
	ArrowRight,
	BarChart3,
	Briefcase,
	Check,
	ChevronDown,
	Clock,
	FileText,
	Link2,
	Radio,
	Shield,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";
import Seo from "../components/Seo";

function getAuth() {
	const token = localStorage.getItem("token");
	const role = localStorage.getItem("role");
	const name = localStorage.getItem("name");
	return token && role && name ? { token, role, name } : null;
}

const FEATURES = [
	{
		icon: Sparkles,
		title: "Neural AI Scoring",
		desc: "Every resume is embedded and scored against the job description using Workers AI — semantic match plus LLM reasoning.",
	},
	{
		icon: Radio,
		title: "Live Leaderboard",
		desc: "Candidates rank in real time via WebSockets. HR sees new applications the moment they're scored — no refresh needed.",
	},
	{
		icon: Link2,
		title: "Shareable Apply Links",
		desc: "Post a job, copy one link, and share it anywhere. Candidates apply in-browser — PDF parsed client-side for privacy.",
	},
	{
		icon: Briefcase,
		title: "Full ATS Pipeline",
		desc: "Browse openings, complete profiles, track application status, and manage candidates from shortlist to hire.",
	},
	{
		icon: Shield,
		title: "Role-Based Access",
		desc: "Separate HR and candidate portals with JWT auth, PBKDF2 password hashing, and server-side RBAC on every protected route.",
	},
	{
		icon: Zap,
		title: "Edge-Native Speed",
		desc: "Runs on Cloudflare Workers at 300+ locations. Zero cold starts, global distribution, D1 + Vectorize + Durable Objects.",
	},
];

const STEPS = [
	{ num: "01", title: "Post a role", desc: "HR creates a job with title and description. AI indexes the description for semantic matching." },
	{ num: "02", title: "Share the link", desc: "Copy the apply URL and distribute it on LinkedIn, email, or your careers page." },
	{ num: "03", title: "Candidates apply", desc: "Applicants upload a PDF resume. AI scores the match in seconds and returns transparent reasoning." },
	{ num: "04", title: "Review & decide", desc: "Watch the live leaderboard, filter by score, view profiles, and move candidates through your pipeline." },
];

const TESTIMONIALS = [
	{
		quote: "We screened 120 applicants in an afternoon. The leaderboard made it obvious who to interview first — saved us two weeks.",
		name: "Priya Mehta",
		role: "Head of Talent, Northline Labs",
	},
	{
		quote: "I applied to three roles and got my AI match score instantly. Knowing where I stood removed all the guesswork.",
		name: "Marcus Chen",
		role: "Software Engineer",
	},
	{
		quote: "The status updates on my dashboard were a nice touch. I always knew when a recruiter moved my application forward.",
		name: "Elena Vasquez",
		role: "Product Designer",
	},
];

const PLANS = [
	{
		name: "Starter",
		price: "Free",
		period: "forever",
		desc: "Everything you need to run a live hiring pilot.",
		features: [
			"Unlimited job postings",
			"AI resume scoring",
			"Live leaderboard",
			"Candidate & HR portals",
			"Application status tracking",
		],
		cta: "Get started",
		ctaTo: "/register/hr",
		highlighted: true,
	},
	{
		name: "Growth",
		price: "$49",
		period: "/ month",
		desc: "For teams hiring at scale with advanced controls.",
		features: [
			"Everything in Starter",
			"Custom score thresholds",
			"Bulk export & reporting",
			"Priority AI inference",
			"Email notifications",
		],
		cta: "Coming soon",
		ctaTo: "/login/hr",
		highlighted: false,
	},
	{
		name: "Enterprise",
		price: "Custom",
		period: "",
		desc: "SSO, compliance, and dedicated support for large orgs.",
		features: [
			"Everything in Growth",
			"SAML / SSO integration",
			"Custom domain & branding",
			"SLA & dedicated support",
			"On-premise deployment option",
		],
		cta: "Contact sales",
		ctaTo: "mailto:hello@hiresight.app",
		highlighted: false,
	},
];

const FAQS = [
	{
		q: "How does AI scoring work?",
		a: "HireSight embeds both the job description and resume using bge-base-en-v1.5, computes cosine similarity via Vectorize, then runs an LLM pass for holistic fit and a two-line explanation.",
	},
	{
		q: "Is candidate data secure?",
		a: "Passwords are hashed with PBKDF2 (100k iterations). JWTs expire after 24 hours. PDFs are parsed in the browser — raw files never leave the candidate's device unless you configure otherwise.",
	},
	{
		q: "Do candidates need an account to apply?",
		a: "Browse-and-apply requires a candidate account. HR can also share a direct apply link that accepts anonymous submissions for external sourcing.",
	},
	{
		q: "Can I use HireSight for multiple jobs?",
		a: "Yes. Each job gets its own leaderboard Durable Object instance, apply link, and candidate pipeline. Post as many roles as you need.",
	},
	{
		q: "What file formats are supported?",
		a: "PDF resumes with an embedded text layer. Scanned image-only PDFs are detected and rejected with a clear error asking for a text-based file.",
	},
	{
		q: "Where is HireSight hosted?",
		a: "On Cloudflare Workers with D1 (SQLite), Vectorize, Workers AI, and Durable Objects — globally distributed with no servers to manage.",
	},
];

function FaqItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className={`landing-faq-item${open ? " open" : ""}`}>
			<button
				type="button"
				className="landing-faq-trigger"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				<span>{q}</span>
				<ChevronDown size={18} className="landing-faq-chevron" aria-hidden="true" />
			</button>
			{open && <p className="landing-faq-answer">{a}</p>}
		</div>
	);
}

export default function HomePage() {
	const auth = getAuth();
	const [email, setEmail] = useState("");

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
		<div className="landing" id="main-content">
			<Seo />
			<Helmet>
				<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
			</Helmet>

			{/* Announcement bar */}
			<div className="landing-announce">
				<Zap size={14} aria-hidden="true" />
				<span>Now live on Cloudflare's global edge — score resumes in under 5 seconds</span>
				<Link to="/jobs" className="landing-announce-link">Browse openings <ArrowRight size={12} /></Link>
			</div>

			{/* Hero */}
			<section className="landing-hero">
				<div className="landing-hero-inner">
					<div className="landing-hero-copy">
						<p className="landing-eyebrow">AI-Powered Hiring Platform</p>
						<h1>
							Hire smarter with <span className="landing-accent">HireSight</span>
						</h1>
						<p className="landing-hero-sub">
							Post a job, share a link, and let AI rank every applicant on a live leaderboard.
							From first application to final offer — one platform, zero guesswork.
						</p>
						<div className="landing-hero-cta">
							<Link to="/register/hr" className="btn btn-primary landing-btn-lg">
								Start hiring free <ArrowRight size={16} />
							</Link>
							<Link to="/jobs" className="btn btn-outline landing-btn-lg">
								Browse open roles
							</Link>
						</div>
						<div className="landing-trust-row">
							<span><Check size={14} /> No credit card</span>
							<span><Check size={14} /> Setup in 2 minutes</span>
							<span><Check size={14} /> WCAG accessible</span>
						</div>
					</div>
					<div className="landing-hero-visual">
						<div className="landing-mock-card">
							<div className="landing-mock-header">
								<span className="live-pill"><span className="live-dot" /> LIVE</span>
								<span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>Senior Engineer — Leaderboard</span>
							</div>
							<div className="landing-mock-rows">
								{[
									{ rank: 1, name: "Alex Rivera", score: 92, badge: "green" },
									{ rank: 2, name: "Jordan Kim", score: 87, badge: "green" },
									{ rank: 3, name: "Sam Okonkwo", score: 74, badge: "yellow" },
								].map((row) => (
									<div key={row.rank} className="landing-mock-row">
										<span className="landing-mock-rank">#{row.rank}</span>
										<span className="landing-mock-name">{row.name}</span>
										<span className={`badge badge-${row.badge}`}>{row.score}</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Stats bar */}
			<section className="landing-stats">
				<div className="landing-stats-inner">
					{[
						{ value: "< 5s", label: "Avg. score time" },
						{ value: "300+", label: "Edge locations" },
						{ value: "2-stage", label: "AI pipeline" },
						{ value: "24/7", label: "Live leaderboard" },
					].map((s) => (
						<div key={s.label} className="landing-stat">
							<span className="landing-stat-value">{s.value}</span>
							<span className="landing-stat-label">{s.label}</span>
						</div>
					))}
				</div>
			</section>

			{/* Features */}
			<section className="landing-section" id="features">
				<div className="landing-section-inner">
					<p className="landing-eyebrow">Why HireSight</p>
					<h2 className="landing-section-title">Everything a modern hiring stack needs</h2>
					<p className="landing-section-sub">
						Built for recruiters who want speed without sacrificing fairness — and candidates who deserve transparency.
					</p>
					<div className="landing-features-grid">
						{FEATURES.map((f) => (
							<div key={f.title} className="landing-feature-card">
								<div className="landing-feature-icon">
									<f.icon size={22} strokeWidth={1.5} />
								</div>
								<h3>{f.title}</h3>
								<p>{f.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* How it works */}
			<section className="landing-section landing-section-alt" id="how-it-works">
				<div className="landing-section-inner">
					<p className="landing-eyebrow">How it works</p>
					<h2 className="landing-section-title">From job post to hire in four steps</h2>
					<div className="landing-steps">
						{STEPS.map((step) => (
							<div key={step.num} className="landing-step">
								<span className="landing-step-num">{step.num}</span>
								<h3>{step.title}</h3>
								<p>{step.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Dual audience */}
			<section className="landing-section">
				<div className="landing-section-inner">
					<div className="landing-split">
						<div className="landing-split-card">
							<div className="landing-split-icon"><Briefcase size={24} /></div>
							<h3>For Recruiters</h3>
							<ul>
								<li>Post jobs and manage your pipeline</li>
								<li>Live AI-ranked leaderboard per role</li>
								<li>Filter candidates by minimum score</li>
								<li>Change status: review → interview → hire</li>
							</ul>
							<Link to="/register/hr" className="btn btn-primary">Open Recruiter Portal</Link>
						</div>
						<div className="landing-split-card">
							<div className="landing-split-icon"><Users size={24} /></div>
							<h3>For Candidates</h3>
							<ul>
								<li>Browse all open roles in one place</li>
								<li>Get instant AI match score + reasoning</li>
								<li>Track application status in real time</li>
								<li>Complete your profile once, apply everywhere</li>
							</ul>
							<Link to="/register/candidate" className="btn btn-outline">Create Candidate Account</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Testimonials */}
			<section className="landing-section landing-section-alt">
				<div className="landing-section-inner">
					<p className="landing-eyebrow">Testimonials</p>
					<h2 className="landing-section-title">Trusted by hiring teams and candidates</h2>
					<div className="landing-testimonials">
						{TESTIMONIALS.map((t) => (
							<blockquote key={t.name} className="landing-testimonial">
								<p>"{t.quote}"</p>
								<footer>
									<strong>{t.name}</strong>
									<span>{t.role}</span>
								</footer>
							</blockquote>
						))}
					</div>
				</div>
			</section>

			{/* Pricing */}
			<section className="landing-section" id="pricing">
				<div className="landing-section-inner">
					<p className="landing-eyebrow">Pricing</p>
					<h2 className="landing-section-title">Simple, transparent plans</h2>
					<p className="landing-section-sub">Start free. Upgrade when your team scales.</p>
					<div className="landing-pricing-grid">
						{PLANS.map((plan) => (
							<div key={plan.name} className={`landing-price-card${plan.highlighted ? " highlighted" : ""}`}>
								{plan.highlighted && <span className="landing-price-badge">Most popular</span>}
								<h3>{plan.name}</h3>
								<div className="landing-price-amount">
									<span className="landing-price-value">{plan.price}</span>
									{plan.period && <span className="landing-price-period">{plan.period}</span>}
								</div>
								<p className="landing-price-desc">{plan.desc}</p>
								<ul>
									{plan.features.map((f) => (
										<li key={f}><Check size={14} /> {f}</li>
									))}
								</ul>
								{plan.ctaTo.startsWith("mailto:") ? (
									<a href={plan.ctaTo} className={`btn ${plan.highlighted ? "btn-primary" : "btn-outline"} btn-full`}>
										{plan.cta}
									</a>
								) : (
									<Link to={plan.ctaTo} className={`btn ${plan.highlighted ? "btn-primary" : "btn-outline"} btn-full`}>
										{plan.cta}
									</Link>
								)}
							</div>
						))}
					</div>
				</div>
			</section>

			{/* FAQ */}
			<section className="landing-section landing-section-alt" id="faq">
				<div className="landing-section-inner landing-faq-wrap">
					<p className="landing-eyebrow">FAQ</p>
					<h2 className="landing-section-title">Frequently asked questions</h2>
					<div className="landing-faq-list">
						{FAQS.map((item) => (
							<FaqItem key={item.q} q={item.q} a={item.a} />
						))}
					</div>
				</div>
			</section>

			{/* Newsletter + final CTA */}
			<section className="landing-cta-band">
				<div className="landing-cta-inner">
					<div className="landing-cta-copy">
						<h2>Ready to transform your hiring?</h2>
						<p>Join recruiters and candidates already using HireSight. Free to start — no credit card required.</p>
						<div className="landing-cta-buttons">
							<Link to="/register/hr" className="btn btn-primary landing-btn-lg">Get started free</Link>
							<Link to="/login/candidate" className="btn btn-outline landing-btn-lg">Sign in as candidate</Link>
						</div>
					</div>
					<div className="landing-newsletter">
						<p className="landing-newsletter-label">Stay updated on new features</p>
						<form
							className="landing-newsletter-form"
							onSubmit={(e) => {
								e.preventDefault();
								if (email) window.location.href = `mailto:hello@hiresight.app?subject=Newsletter&body=Subscribe: ${encodeURIComponent(email)}`;
							}}
						>
							<input
								type="email"
								placeholder="you@company.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								aria-label="Email for newsletter"
							/>
							<button type="submit" className="btn btn-primary">Subscribe</button>
						</form>
					</div>
				</div>
			</section>

			{/* Trust footer strip */}
			<section className="landing-trust-strip">
				<div className="landing-trust-strip-inner">
					<span><BarChart3 size={16} /> Real-time analytics</span>
					<span><FileText size={16} /> PDF resume parsing</span>
					<span><Clock size={16} /> 24h JWT sessions</span>
					<span><Shield size={16} /> PBKDF2 password hashing</span>
				</div>
			</section>
		</div>
	);
}
