export interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	from?: string;
}

export interface SendEmailResult {
	success: boolean;
	id?: string;
	error?: string;
}

/**
 * Send a transactional HTML email via Resend REST API (Cloudflare Workers compatible).
 * Uses native fetch() — zero external npm dependencies required.
 */
export async function sendEmail(
	env: Env,
	options: SendEmailOptions
): Promise<SendEmailResult> {
	const apiKey = env.RESEND_API_KEY;

	if (!apiKey || apiKey === "re_placeholder_key") {
		console.warn("[email] RESEND_API_KEY is not configured or using placeholder. Email skipped for:", options.to);
		return {
			success: false,
			error: "RESEND_API_KEY not configured",
		};
	}

	const from = options.from ?? "HireSight <onboarding@resend.dev>";

	try {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from,
				to: [options.to],
				subject: options.subject,
				html: options.html,
			}),
		});

		const data = (await res.json()) as { id?: string; message?: string; statusCode?: number };

		if (!res.ok) {
			console.error("[email] Resend API error:", res.status, data);
			return {
				success: false,
				error: data.message ?? `Resend API returned status ${res.status}`,
			};
		}

		console.log("[email] Email sent successfully to", options.to, "ID:", data.id);
		return {
			success: true,
			id: data.id,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[email] Failed to send email to", options.to, msg);
		return {
			success: false,
			error: msg,
		};
	}
}
