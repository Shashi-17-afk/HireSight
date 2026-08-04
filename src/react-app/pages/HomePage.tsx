import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
	ArrowRight,
	Briefcase,
	Check,
	ChevronDown,
	Link2,
	Radio,
	Shield,
	Sparkles,
	Zap,
} from "lucide-react";
import Seo from "../components/Seo";

const FEATURES = [
	{
		icon: Sparkles,
		title: "Neural AI Resume Scoring",
		desc: "Every candidate resume is embedded and scored against job criteria using Cloudflare Workers AI — semantic vector matching plus LLM reasoning.",
		colorClass: "pill-yellow"
	},
	{
		icon: Radio,
		title: "Real-Time Leaderboard",
		desc: "Candidates rank dynamically via WebSockets. HR recruiters view new applications the moment they submit — with zero manual refreshes.",
		colorClass: "pill-pink"
	},
	{
		icon: Link2,
		title: "Instant Shareable Links",
		desc: "Create a job opening in seconds, copy the unique apply URL, and distribute anywhere. PDFs are parsed client-side for total privacy.",
		colorClass: "pill-green"
	},
	{
		icon: Briefcase,
		title: "Full ATS Pipeline",
		desc: "Browse openings, maintain applicant profiles, track hiring statuses, and manage candidate pipelines from shortlist to offer letter.",
		colorClass: "pill-purple"
	},
	{
		icon: Shield,
		title: "Enterprise Access Control",
		desc: "Dedicated HR and Candidate portals with secure JWT auth, PBKDF2 password hashing, and server-side RBAC protection on all endpoints.",
		colorClass: "pill-blue"
	},
	{
		icon: Zap,
		title: "Edge-Native Speed",
		desc: "Runs globally across 300+ edge locations with Cloudflare Workers, D1 database, Vectorize, and Durable Objects for instant response.",
		colorClass: "pill-yellow"
	},
];

const STEPS = [
	{ num: "01", title: "Post a job role", desc: "Recruiters define a job title and description. AI embeds key requirements for semantic matching." },
	{ num: "02", title: "Share the link", desc: "Copy the unique apply URL and share across LinkedIn, job boards, or directly with applicants." },
	{ num: "03", title: "AI screens applicants", desc: "Candidates upload PDF resumes. Workers AI evaluates match percentage and produces transparent reasoning." },
	{ num: "04", title: "Rank & hire top fit", desc: "Monitor the real-time leaderboard, view full candidate profiles, and shortlist top talent effortlessly." },
];

const TESTIMONIALS = [
	{
		quote: "We screened 120 applicants in an afternoon. The live leaderboard made it obvious who to interview first — saving our team weeks.",
		name: "Priya Mehta",
		role: "Head of Talent, Northline Labs",
		avatar: "/images/avatar-1.png",
	},
	{
		quote: "Applying took under a minute, and I received instant AI feedback on how my skills matched the job requirements.",
		name: "Marcus Chen",
		role: "Senior Software Engineer",
		avatar: "/images/avatar-2.png",
	},
	{
		quote: "The status tracking kept me completely informed. I always knew when HR moved my application to the interview stage.",
		name: "Elena Vasquez",
		role: "Product Designer",
		avatar: "/images/avatar-3.png",
	},
];

const PLANS = [
	{
		name: "Starter",
		price: "Free",
		period: "forever",
		desc: "Everything you need to automate candidate screening.",
		features: [
			"Unlimited job postings",
			"AI resume scoring",
			"Real-time live leaderboard",
			"Candidate & HR portals",
			"Application status tracking",
		],
		cta: "Get started free",
		ctaTo: "/register/hr",
		featured: true,
		razorpay: false,
	},
	{
		name: "Growth",
		price: "₹4,099",
		period: "/ month",
		desc: "For growing teams hiring at higher volume.",
		features: [
			"Everything in Starter",
			"Custom AI score thresholds",
			"Bulk PDF export & analytics",
			"Priority Workers AI inference",
			"Automated email notifications",
		],
		cta: "Subscribe — ₹4,099/mo",
		ctaTo: "",
		featured: false,
		razorpay: true,
		amountPaise: 409900,
	},
	{
		name: "Enterprise",
		price: "Custom",
		period: "",
		desc: "Custom AI models, SAML SSO, and compliance.",
		features: [
			"Everything in Growth",
			"SAML / SSO integration",
			"Custom domain & branding",
			"Dedicated SLA & 24/7 support",
			"Custom resume parsing rules",
		],
		cta: "Contact sales",
		ctaTo: "mailto:hello@hiresight.app",
		featured: false,
		razorpay: false,
	},
];

const FAQS = [
	{
		q: "How does AI resume scoring work?",
		a: "HireSight embeds both job requirements and applicant resumes into semantic vector representations using Workers AI (bge-base-en-v1.5), computes match similarity via Cloudflare Vectorize, and generates concise fit reasoning with LLM inference.",
	},
	{
		q: "Is candidate resume data private and secure?",
		a: "Yes. Passwords are salted and hashed using PBKDF2 (100k iterations). PDFs are parsed in-browser where text is extracted safely. Data transmitted over Workers API is encrypted in transit and at rest.",
	},
	{
		q: "Can HR recruiters post multiple jobs simultaneously?",
		a: "Absolutely. Each posted job creates a dedicated Durable Object instance powering its own real-time leaderboard, candidate pipeline, and shareable apply link.",
	},
	{
		q: "What resume file formats are accepted?",
		a: "Standard text-based PDF files are supported. Text is extracted client-side so applicants get immediate confirmation before submission.",
	},
];

function FaqItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="faq-item" onClick={() => setOpen(!open)}>
			<div className="faq-question">
				<span>{q}</span>
				<ChevronDown
					size={18}
					style={{
						transform: open ? "rotate(180deg)" : "rotate(0deg)",
						transition: "transform 0.2s ease"
					}}
				/>
			</div>
			{open && <p className="faq-answer">{a}</p>}
		</div>
	);
}

export default function HomePage() {
	const [email, setEmail] = useState("");
	const [subscribed, setSubscribed] = useState(false);
	const [paymentLoading, setPaymentLoading] = useState(false);
	const [paymentMsg, setPaymentMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [isSubscribed, setIsSubscribed] = useState(false);

	// Check if current HR user already has an active subscription
	useEffect(() => {
		const token = localStorage.getItem("token");
		const role = localStorage.getItem("role");
		if (!token || role !== "HR") return;

		fetch("/api/payments/status", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => {
				if (res.status === 401) {
					localStorage.clear();
					window.dispatchEvent(new Event("storage"));
					return null;
				}
				return res.ok ? res.json() : null;
			})
			.then((data: { subscribed?: boolean } | null) => {
				if (data?.subscribed) setIsSubscribed(true);
			})
			.catch(() => { /* ignore — non-critical */ });
	}, []);

	function handleSubscribe(e: React.FormEvent) {
		e.preventDefault();
		if (email) setSubscribed(true);
	}

	async function handleRazorpayCheckout(amountPaise: number, planName: string) {
		const token = localStorage.getItem("token");
		if (!token) {
			setPaymentMsg({ type: "error", text: "Please sign in as a recruiter to subscribe." });
			return;
		}

		setPaymentLoading(true);
		setPaymentMsg(null);

		try {
			// Step 1: Create order
			const orderRes = await fetch("/api/payments/create-order", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ amount: amountPaise, currency: "INR", plan: planName }),
			});

			if (orderRes.status === 401) {
				localStorage.clear();
				window.dispatchEvent(new Event("storage"));
				throw new Error("Your session has expired. Please sign in again.");
			}

			if (!orderRes.ok) {
				const errData = (await orderRes.json()) as { error?: string };
				throw new Error(errData.error ?? "Failed to create payment order");
			}

			const order = (await orderRes.json()) as {
				order_id: string;
				amount: number;
				currency: string;
				key_id: string;
			};

			// Step 2: Open Razorpay modal
			const userName = localStorage.getItem("name") ?? "";

			const options: RazorpayOptions = {
				key: order.key_id,
				amount: order.amount,
				currency: order.currency,
				name: "HireSight",
				description: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan — Monthly`,
				order_id: order.order_id,
				prefill: { name: userName },
				theme: { color: "#1a1a2e" },
				modal: {
					ondismiss: () => {
						setPaymentLoading(false);
						setPaymentMsg({ type: "error", text: "Payment cancelled." });
					},
				},
				handler: async (response: RazorpayResponse) => {
					// Step 3: Verify payment signature
					try {
						const verifyRes = await fetch("/api/payments/verify", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${token}`,
							},
							body: JSON.stringify({
								razorpay_order_id: response.razorpay_order_id,
								razorpay_payment_id: response.razorpay_payment_id,
								razorpay_signature: response.razorpay_signature,
							}),
						});

						if (!verifyRes.ok) {
							const errData = (await verifyRes.json()) as { error?: string };
							throw new Error(errData.error ?? "Payment verification failed");
						}

						setPaymentMsg({ type: "success", text: "Payment successful! Your Growth plan is now active. 🎉" });
						setIsSubscribed(true);
					} catch (verifyErr) {
						setPaymentMsg({
							type: "error",
							text: verifyErr instanceof Error ? verifyErr.message : "Payment verification failed.",
						});
					} finally {
						setPaymentLoading(false);
					}
				},
			};

			const rzp = new window.Razorpay(options);
			rzp.open();
		} catch (err) {
			setPaymentMsg({
				type: "error",
				text: err instanceof Error ? err.message : "Something went wrong.",
			});
			setPaymentLoading(false);
		}
	}

	return (
		<div className="page-wide" id="main-content">
			<Seo />
			<Helmet>
				<title>HireSight — AI Candidate Screening & Live Leaderboard</title>
			</Helmet>

			{/* Hero Section */}
			<section className="hero-section">
				<h1 className="hero-title">
					Automate <span className="pill-highlight pill-yellow">hiring</span> & find top{" "}
					<span className="pill-highlight pill-pink">candidates</span> in{" "}
					<span className="pill-highlight pill-green">seconds</span>
				</h1>

				<p className="hero-subtitle">
					Post open roles, share instant apply links, and let Workers AI rank every candidate on a live real-time leaderboard. Faster, fairer, and zero guesswork.
				</p>

				<div className="hero-cta-group">
					{Boolean(localStorage.getItem("token") && localStorage.getItem("role")) ? (
						<Link to={localStorage.getItem("role") === "HR" ? "/hr/dashboard" : "/candidate/dashboard"} className="btn btn-dark-pill btn-lg">
							Go to Dashboard <ArrowRight size={18} />
						</Link>
					) : (
						<Link to="/register/hr" className="btn btn-dark-pill btn-lg">
							Start hiring free <ArrowRight size={18} />
						</Link>
					)}
					<Link to="/jobs" className="btn btn-secondary btn-lg">
						Explore openings
					</Link>
				</div>

				{/* Scattered Image Composition (trams-eight design) */}
				<div className="scattered-container">
					<div className="scattered-card card-lg">
						<img src="/images/team-boardroom.png" alt="Boardroom Executives" />
					</div>
					<div className="scattered-card card-md">
						<img src="/images/team-office.png" alt="Team Collaboration" />
					</div>
					<div className="scattered-card card-sm">
						<img src="/images/avatar-1.png" alt="Candidate Alex" />
					</div>
				</div>

				<div className="avatars-group">
					<img src="/images/avatar-1.png" alt="Alex" className="avatar-img" />
					<img src="/images/avatar-2.png" alt="Jordan" className="avatar-img" />
					<img src="/images/avatar-3.png" alt="Elena" className="avatar-img" />
					<span style={{ marginLeft: "1rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)" }}>
						Screened over 10,000+ candidates globally
					</span>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" style={{ padding: "5rem 0" }}>
				<div className="section-header">
					<span className="section-tag">Key Capabilities</span>
					<h2 className="section-title">
						Built for modern <span className="pill-highlight pill-purple">recruiting teams</span>
					</h2>
					<p className="section-desc">
						Everything you need to automate resume evaluation, eliminate hiring bias, and shortlist top talent in seconds.
					</p>
				</div>

				<div className="grid-3">
					{FEATURES.map((item, i) => {
						const Icon = item.icon;
						return (
							<div key={i} className="feature-card">
								<div className="feature-icon-wrapper">
									<Icon size={24} />
								</div>
								<h3 className="feature-title">{item.title}</h3>
								<p className="feature-desc">{item.desc}</p>
							</div>
						);
					})}
				</div>
			</section>

			{/* How it Works Section */}
			<section id="how-it-works" style={{ padding: "5rem 0" }}>
				<div className="section-header">
					<span className="section-tag">Four Simple Steps</span>
					<h2 className="section-title">
						How HireSight <span className="pill-highlight pill-pink">streamlines</span> hiring
					</h2>
				</div>

				<div className="grid-2">
					{STEPS.map((step, i) => (
						<div key={i} className="step-card">
							<div className="step-num">{step.num}</div>
							<h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>{step.title}</h3>
							<p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>{step.desc}</p>
						</div>
					))}
				</div>
			</section>

			{/* Testimonials */}
			<section style={{ padding: "5rem 0" }}>
				<div className="section-header">
					<span className="section-tag">Loved by Recruiters</span>
					<h2 className="section-title">
						Loved by <span className="pill-highlight pill-yellow">recruiters</span> & candidates
					</h2>
				</div>

				<div className="grid-3">
					{TESTIMONIALS.map((t, i) => (
						<div key={i} className="testimonial-card">
							<p className="testimonial-quote">"{t.quote}"</p>
							<div className="testimonial-author">
								<img src={t.avatar} alt={t.name} className="author-avatar" />
								<div>
									<div className="author-name">{t.name}</div>
									<div className="author-role">{t.role}</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Pricing */}
			<section id="pricing" style={{ padding: "5rem 0" }}>
				<div className="section-header">
					<span className="section-tag">Transparent Plans</span>
					<h2 className="section-title">
						Simple pricing for <span className="pill-highlight pill-green">every team</span>
					</h2>
				</div>

				{paymentMsg && (
					<div className={`payment-toast payment-toast--${paymentMsg.type}`}>
						<span>{paymentMsg.text}</span>
						<button type="button" className="payment-toast-close" onClick={() => setPaymentMsg(null)}>✕</button>
					</div>
				)}

				<div className="grid-3">
					{PLANS.map((p, i) => (
						<div key={i} className={`pricing-card${p.featured ? " featured" : ""}`}>
							<h3 className="pricing-title" style={{ fontSize: "1.4rem" }}>{p.name}</h3>
							<div className="pricing-price">
								{p.price}<span style={{ fontSize: "1rem", fontWeight: 400 }}> {p.period}</span>
							</div>
							<p className="pricing-desc" style={{ fontSize: "0.92rem", opacity: 0.8 }}>{p.desc}</p>
							<ul className="pricing-features">
								{p.features.map((f, fi) => (
									<li key={fi}>
										<Check size={16} style={{ color: p.featured ? "#ffffff" : "var(--status-green)" }} />
										{f}
									</li>
								))}
							</ul>
							<div style={{ marginTop: "auto" }}>
								{p.razorpay ? (
									isSubscribed ? (
										<button
											type="button"
											className="btn btn-subscribed"
											style={{ width: "100%" }}
											disabled
										>
											<Check size={16} /> Subscribed
										</button>
									) : (
										<button
											type="button"
											id="razorpay-checkout-btn"
											className="btn btn-primary"
											style={{ width: "100%" }}
											disabled={paymentLoading}
											onClick={() => void handleRazorpayCheckout(p.amountPaise!, p.name.toLowerCase())}
										>
											{paymentLoading ? "Processing…" : p.cta}
										</button>
									)
								) : (
									<Link
										to={
											Boolean(localStorage.getItem("token") && localStorage.getItem("role")) && p.ctaTo.startsWith("/register")
												? (localStorage.getItem("role") === "HR" ? "/hr/dashboard" : "/candidate/dashboard")
												: p.ctaTo
										}
										className={`btn ${p.featured ? "btn-secondary" : "btn-primary"}`}
										style={{ width: "100%" }}
									>
										{Boolean(localStorage.getItem("token") && localStorage.getItem("role")) && p.ctaTo.startsWith("/register") ? "Go to Dashboard" : p.cta}
									</Link>
								)}
							</div>
						</div>
					))}
				</div>
			</section>

			{/* FAQ Accordion */}
			<section id="faq" style={{ padding: "5rem 0" }}>
				<div className="section-header">
					<span className="section-tag">Frequently Asked</span>
					<h2 className="section-title">
						Everything you <span className="pill-highlight pill-blue">need to know</span>
					</h2>
				</div>

				<div className="faq-list">
					{FAQS.map((faq, i) => (
						<FaqItem key={i} q={faq.q} a={faq.a} />
					))}
				</div>
			</section>

			{/* Newsletter Subscribe Banner */}
			<section className="newsletter-banner">
				<h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
					Ready to transform your hiring workflow?
				</h2>
				<p style={{ color: "var(--text-secondary)", maxWidth: "540px", margin: "0 auto" }}>
					Join thousands of recruiters and candidates using AI for faster, smarter resume screening.
				</p>
				{subscribed ? (
					<div style={{ marginTop: "1.5rem", fontWeight: 600, color: "var(--status-green)" }}>
						<Check size={20} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
						Thank you for subscribing! We'll keep you updated.
					</div>
				) : (
					<form className="newsletter-form" onSubmit={handleSubscribe}>
						<input
							type="email"
							placeholder="Enter your work email..."
							className="form-input"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
						<button type="submit" className="btn btn-dark-pill" style={{ flexShrink: 0 }}>
							Subscribe Now
						</button>
					</form>
				)}
			</section>
		</div>
	);
}
