/**
 * Responsive HTML Email Templates for HireSight
 * Styled with HireSight's design tokens (Poppins/Satoshi typography, dark pills, status badges)
 */

export interface CandidateConfirmationParams {
	candidateName: string;
	jobTitle: string;
	companyName?: string;
	dashboardUrl: string;
}

export interface StatusUpdateParams {
	candidateName: string;
	jobTitle: string;
	newStatus: string;
	note?: string | null;
	dashboardUrl: string;
}

export interface RecruiterSubscriptionParams {
	recruiterName: string;
	planName: string;
	amountPaid: string;
	paymentId: string;
	orderId: string;
	date: string;
}

export interface RecruiterNewApplicantParams {
	recruiterName: string;
	candidateName: string;
	candidateEmail: string;
	jobTitle: string;
	matchScore: number;
	reasoning: string;
	hrDashboardUrl: string;
}

const statusColorMap: Record<string, { bg: string; text: string; label: string }> = {
	applied: { bg: "#eff6ff", text: "#3b82f6", label: "Applied" },
	under_review: { bg: "#fffbe6", text: "#f59e0b", label: "Under Review" },
	shortlisted: { bg: "#ecfdf5", text: "#10b981", label: "Shortlisted" },
	interview: { bg: "#f3e8ff", text: "#8b5cf6", label: "Interview Scheduled" },
	rejected: { bg: "#fef2f2", text: "#ef4444", label: "Application Closed" },
	hired: { bg: "#ecfdf5", text: "#10b981", label: "Hired 🎉" },
	offered: { bg: "#ecfdf5", text: "#059669", label: "Offer Extended 📄" },
};

function baseWrapper(content: string): string {
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HireSight Notification</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f6f6f4; font-family: 'Poppins', system-ui, -apple-system, sans-serif; color: #0d0d0d; }
    .container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
    .header { background: #0d0d0d; padding: 24px 32px; text-align: left; }
    .logo { color: #ffffff; font-size: 22px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px; }
    .logo-dot { display: inline-block; width: 6px; height: 6px; background: #ff5b5b; border-radius: 50%; margin-left: 4px; }
    .content { padding: 32px; }
    .btn { display: inline-block; background: #0d0d0d; color: #ffffff !important; padding: 12px 28px; border-radius: 9999px; font-weight: 600; font-size: 14px; text-decoration: none; margin-top: 20px; }
    .footer { padding: 20px 32px; background: #f2f2ef; font-size: 12px; color: #888888; text-align: center; border-top: 1px solid rgba(0,0,0,0.06); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; margin: 10px 0; }
    .card-info { background: #f6f6f4; border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid rgba(0,0,0,0.06); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://hiresight.shashishanthan2706.workers.dev" class="logo">HireSight<span class="logo-dot"></span></a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} HireSight — AI-Powered Candidate Screening & Recruitment.<br>
      You are receiving this transactional email because of your activity on HireSight.
    </div>
  </div>
</body>
</html>`;
}

/** 1. Candidate Application Confirmation */
export function getApplicantConfirmationEmail(params: CandidateConfirmationParams): { subject: string; html: string } {
	const subject = `Application Received: ${params.jobTitle} at HireSight`;
	const html = baseWrapper(`
		<h2 style="font-size: 20px; margin-top: 0;">Application Submitted Successfully!</h2>
		<p>Hi <strong>${params.candidateName}</strong>,</p>
		<p>Your application for the <strong>${params.jobTitle}</strong> position has been successfully submitted and scored by Workers AI.</p>
		
		<div class="card-info">
			<div style="font-size: 12px; color: #888888; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Role Applied</div>
			<div style="font-size: 16px; font-weight: 700; color: #0d0d0d;">${params.jobTitle}</div>
			${params.companyName ? `<div style="font-size: 13px; color: #555555; margin-top: 2px;">${params.companyName}</div>` : ""}
		</div>

		<p>You can monitor your application status in real-time from your Candidate Dashboard:</p>
		<div style="text-align: center;">
			<a href="${params.dashboardUrl}" class="btn">View Candidate Dashboard →</a>
		</div>
	`);
	return { subject, html };
}

/** 2. Candidate Status Update Notification */
export function getStatusUpdateEmail(params: StatusUpdateParams): { subject: string; html: string } {
	const statusInfo = statusColorMap[params.newStatus] ?? { bg: "#f0f0ed", text: "#0d0d0d", label: params.newStatus };
	const subject = `Status Update: ${params.jobTitle} — ${statusInfo.label}`;
	
	const html = baseWrapper(`
		<h2 style="font-size: 20px; margin-top: 0;">Application Status Update</h2>
		<p>Hi <strong>${params.candidateName}</strong>,</p>
		<p>There is an update on your application for <strong>${params.jobTitle}</strong>:</p>

		<div class="card-info" style="text-align: center;">
			<div style="font-size: 12px; color: #888888; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">New Status</div>
			<div class="badge" style="background: ${statusInfo.bg}; color: ${statusInfo.text};">${statusInfo.label}</div>
		</div>

		${params.note ? `
			<div style="background: #ffffff; border-left: 4px solid #0d0d0d; padding: 12px 16px; margin: 16px 0; font-style: italic; color: #555555;">
				"${params.note}"
			</div>
		` : ""}

		<p>Log in to your Candidate Dashboard for more details:</p>
		<div style="text-align: center;">
			<a href="${params.dashboardUrl}" class="btn">Go to Candidate Dashboard →</a>
		</div>
	`);
	return { subject, html };
}

/** 3. Recruiter Subscription Payment Receipt */
export function getRecruiterSubscriptionEmail(params: RecruiterSubscriptionParams): { subject: string; html: string } {
	const subject = `Payment Confirmation: HireSight ${params.planName} Plan`;
	const html = baseWrapper(`
		<h2 style="font-size: 20px; margin-top: 0; color: #10b981;">Subscription Active! 🎉</h2>
		<p>Hi <strong>${params.recruiterName}</strong>,</p>
		<p>Thank you for subscribing to the <strong>HireSight ${params.planName} Plan</strong>. Your account has been upgraded successfully.</p>

		<div class="card-info">
			<div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 8px;">Receipt Details</div>
			<table style="width: 100%; font-size: 13px; border-collapse: collapse;">
				<tr><td style="padding: 4px 0; color: #888888;">Plan:</td><td style="text-align: right; font-weight: 600;">${params.planName} Plan</td></tr>
				<tr><td style="padding: 4px 0; color: #888888;">Amount Paid:</td><td style="text-align: right; font-weight: 600; color: #10b981;">${params.amountPaid}</td></tr>
				<tr><td style="padding: 4px 0; color: #888888;">Payment ID:</td><td style="text-align: right; font-family: monospace;">${params.paymentId}</td></tr>
				<tr><td style="padding: 4px 0; color: #888888;">Order ID:</td><td style="text-align: right; font-family: monospace;">${params.orderId}</td></tr>
				<tr><td style="padding: 4px 0; color: #888888;">Date:</td><td style="text-align: right;">${params.date}</td></tr>
			</table>
		</div>

		<div style="text-align: center;">
			<a href="https://hiresight.shashishanthan2706.workers.dev/hr/dashboard" class="btn">Open Recruiter Workspace →</a>
		</div>
	`);
	return { subject, html };
}

/** 4. Recruiter Instant Alert for New Applicant */
export function getRecruiterNewApplicantAlertEmail(params: RecruiterNewApplicantParams): { subject: string; html: string } {
	const subject = `New Applicant: ${params.candidateName} for ${params.jobTitle}`;
	const html = baseWrapper(`
		<h2 style="font-size: 20px; margin-top: 0;">New Applicant Alert ⚡</h2>
		<p>Hi <strong>${params.recruiterName}</strong>,</p>
		<p>A new applicant has submitted their resume for <strong>${params.jobTitle}</strong>.</p>

		<div class="card-info">
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
				<div>
					<div style="font-size: 16px; font-weight: 700;">${params.candidateName}</div>
					<div style="font-size: 13px; color: #555555;">${params.candidateEmail}</div>
				</div>
				<div style="background: #f9c35a; color: #0d0d0d; font-size: 18px; font-weight: 700; padding: 6px 12px; border-radius: 9999px;">
					${params.matchScore}% Match
				</div>
			</div>
			${params.reasoning ? `
				<div style="font-size: 12px; color: #555555; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.08);">
					<strong>AI Fit Reasoning:</strong> ${params.reasoning}
				</div>
			` : ""}
		</div>

		<div style="text-align: center;">
			<a href="${params.hrDashboardUrl}" class="btn">View Live Leaderboard →</a>
		</div>
	`);
	return { subject, html };
}
