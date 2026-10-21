export interface EmailAttachment {
	name: string;
	content: string; // Base64 encoded string
}

export interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	from?: string;
	attachments?: EmailAttachment[];
}

export interface SendEmailResult {
	success: boolean;
	id?: string;
	error?: string;
}

/**
 * Send a transactional HTML email via Brevo REST API (or Resend API fallback).
 * Uses native fetch() — zero external npm dependencies required.
 * Supports base64 attachments (e.g. PDF Offer Letters).
 */
export async function sendEmail(
	env: Env,
	options: SendEmailOptions
): Promise<SendEmailResult> {
	const brevoKey = env.BREVO_API_KEY;
	const resendKey = env.RESEND_API_KEY;

	// Primary Engine: Brevo (Delivers to ALL recipients for 100% free)
	if (brevoKey && brevoKey !== "brevo_placeholder_key") {
		try {
			const brevoBody: Record<string, unknown> = {
				sender: { name: "HireSight AI", email: "shashishanthan2706@gmail.com" },
				to: [{ email: options.to }],
				subject: options.subject,
				htmlContent: options.html,
			};

			if (options.attachments && options.attachments.length > 0) {
				brevoBody.attachment = options.attachments.map((att) => ({
					name: att.name,
					content: att.content,
				}));
			}

			const res = await fetch("https://api.brevo.com/v3/smtp/email", {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json",
					"api-key": brevoKey,
				},
				body: JSON.stringify(brevoBody),
			});

			const data = (await res.json()) as { messageId?: string; message?: string; code?: string };

			if (res.ok) {
				console.log("[email] Brevo email sent successfully to", options.to, "ID:", data.messageId);
				return {
					success: true,
					id: data.messageId,
				};
			} else {
				console.warn("[email] Brevo API error:", res.status, data, "— falling back to Resend");
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn("[email] Failed to send Brevo email to", options.to, msg, "— falling back to Resend");
		}
	}

	// Fallback Engine: Resend API
	if (resendKey && resendKey !== "re_placeholder_key") {
		const from = options.from ?? "HireSight <onboarding@resend.dev>";
		try {
			const resendBody: Record<string, unknown> = {
				from,
				to: [options.to],
				subject: options.subject,
				html: options.html,
			};

			if (options.attachments && options.attachments.length > 0) {
				resendBody.attachments = options.attachments.map((att) => ({
					filename: att.name,
					content: att.content,
				}));
			}

			const res = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${resendKey}`,
				},
				body: JSON.stringify(resendBody),
			});

			const data = (await res.json()) as { id?: string; message?: string };

			if (!res.ok) {
				console.error("[email] Resend API error:", res.status, data);
				return {
					success: false,
					error: data.message ?? `Resend API returned status ${res.status}`,
				};
			}

			console.log("[email] Resend email sent successfully to", options.to, "ID:", data.id);
			return {
				success: true,
				id: data.id,
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[email] Failed to send Resend email to", options.to, msg);
			return {
				success: false,
				error: msg,
			};
		}
	}

	console.warn("[email] Neither BREVO_API_KEY nor RESEND_API_KEY configured. Email skipped for:", options.to);
	return {
		success: false,
		error: "Email API key not configured",
	};
}

