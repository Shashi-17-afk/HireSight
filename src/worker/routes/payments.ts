import { Hono } from "hono";
import { authenticate, requireHR } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";
import { sendEmail } from "../lib/email";
import { getRecruiterSubscriptionEmail, getSubscriptionPaymentFailedEmail } from "../lib/email-templates";

const payments = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an ArrayBuffer to a lowercase hex string. */
function bufToHex(buf: ArrayBuffer): string {
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Constant-time string comparison for signatures. */
function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** HMAC-SHA256 signature using Web Crypto (Cloudflare Workers compatible). */
async function hmacSha256(message: string, secret: string): Promise<string> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
	return bufToHex(sig);
}

// Server-side price list. The client only names a plan; it never sets the
// amount, otherwise a recruiter could pay ₹1 for a paid plan.
const PLANS: Record<string, { amount: number; currency: string; label: string; display: string }> = {
	growth: { amount: 409900, currency: "INR", label: "Growth", display: "₹4,099" },
};

// ── POST /api/payments/create-order ──────────────────────────────────────────

payments.post("/create-order", authenticate(), requireHR(), async (c) => {
	let body: { plan?: string } = {};
	try {
		body = await c.req.json();
	} catch {
		body = {};
	}
	const user = c.get("user");

	const plan = (body.plan ?? "growth").toLowerCase();
	const planInfo = PLANS[plan];
	if (!planInfo) {
		return c.json({ error: "Unknown plan" }, 400);
	}
	const { amount, currency } = planInfo;

	const keyId = c.env.RAZORPAY_KEY_ID;
	const keySecret = c.env.RAZORPAY_KEY_SECRET;
	if (!keyId || !keySecret) {
		console.error("[payments] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured");
		return c.json({ error: "Payment gateway not configured" }, 500);
	}

	// Call Razorpay Orders API
	const receipt = `rcpt_${crypto.randomUUID().slice(0, 8)}`;
	let rzpOrder: { id: string; amount: number; currency: string };

	try {
		const res = await fetch("https://api.razorpay.com/v1/orders", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
			},
			body: JSON.stringify({ amount, currency, receipt }),
		});

		if (!res.ok) {
			const errBody = await res.text();
			console.error("[payments] Razorpay create order failed:", res.status, errBody);
			return c.json({ error: "Failed to create payment order" }, 502);
		}

		rzpOrder = (await res.json()) as { id: string; amount: number; currency: string };
	} catch (err) {
		console.error("[payments] Razorpay API error:", String(err));
		return c.json({ error: "Payment gateway unavailable" }, 502);
	}

	// Persist order in D1
	const paymentId = crypto.randomUUID();
	try {
		await c.env.DB.prepare(
			`INSERT INTO payments (id, user_id, razorpay_order_id, plan, amount, currency, status)
			 VALUES (?, ?, ?, ?, ?, ?, 'created')`
		)
			.bind(paymentId, user.id, rzpOrder.id, plan, amount, currency)
			.run();
	} catch (err) {
		console.error("[payments] D1 insert failed:", String(err));
		// Verification needs this row, so don't hand out an order we can't verify.
		return c.json({ error: "Failed to record payment order" }, 500);
	}

	return c.json({
		order_id: rzpOrder.id,
		amount: rzpOrder.amount,
		currency: rzpOrder.currency,
		key_id: keyId,
	});
});

// ── POST /api/payments/verify ────────────────────────────────────────────────

payments.post("/verify", authenticate(), requireHR(), async (c) => {
	const body = await c.req.json<{
		razorpay_order_id?: string;
		razorpay_payment_id?: string;
		razorpay_signature?: string;
	}>();

	const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

	if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
		return c.json({ error: "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature" }, 400);
	}

	// The order must have been created by this recruiter through create-order,
	// for a known plan at that plan's server-side price.
	const order = await c.env.DB.prepare(
		"SELECT plan, amount, currency FROM payments WHERE razorpay_order_id = ? AND user_id = ?"
	)
		.bind(razorpay_order_id, c.get("user").id)
		.first<{ plan: string; amount: number; currency: string }>();
	const orderPlan = order ? PLANS[order.plan] : undefined;
	if (!order || !orderPlan || order.amount !== orderPlan.amount || order.currency !== orderPlan.currency) {
		return c.json({ error: "Payment order not found" }, 404);
	}

	const keySecret = c.env.RAZORPAY_KEY_SECRET;
	if (!keySecret) {
		return c.json({ error: "Payment gateway not configured" }, 500);
	}

	// Verify HMAC-SHA256 signature: HMAC(order_id|payment_id, secret)
	const expectedSignature = await hmacSha256(
		`${razorpay_order_id}|${razorpay_payment_id}`,
		keySecret
	);

	if (!timingSafeEqualHex(expectedSignature, razorpay_signature)) {
		console.error("[payments] Signature mismatch for order", razorpay_order_id);

		// Trigger Subscription Payment Failed Email to HR Recruiter
		try {
			const user = c.get("user");
			const userDetails = await c.env.DB.prepare("SELECT name, email FROM users WHERE id = ?")
				.bind(user.id)
				.first<{ name: string; email: string }>();

			if (userDetails?.email) {
				const failedTpl = getSubscriptionPaymentFailedEmail({
					recruiterName: userDetails.name || "Recruiter",
					planName: orderPlan.label,
					amount: orderPlan.display,
					failureReason: "Payment verification failed due to invalid signature or declined authorization.",
					retryPaymentUrl: "https://hiresight.shashishanthan2706.workers.dev/hr/dashboard",
				});
				await sendEmail(c.env, {
					to: userDetails.email,
					subject: failedTpl.subject,
					html: failedTpl.html,
				});
			}
		} catch (emailErr) {
			console.error("[payments] Payment failed email dispatch error:", String(emailErr));
		}

		return c.json({ error: "Payment verification failed: signature mismatch" }, 400);
	}

	// Update payment record in D1
	try {
		await c.env.DB.prepare(
			`UPDATE payments
			    SET razorpay_payment_id = ?,
			        status = 'paid',
			        signature_verified = 1,
			        updated_at = CURRENT_TIMESTAMP
			  WHERE razorpay_order_id = ? AND user_id = ?`
		)
			.bind(razorpay_payment_id, razorpay_order_id, c.get("user").id)
			.run();

		// Trigger Subscription Receipt Email to HR Recruiter
		const user = c.get("user");
		const userDetails = await c.env.DB.prepare("SELECT name, email FROM users WHERE id = ?")
			.bind(user.id)
			.first<{ name: string; email: string }>();

		if (userDetails?.email) {
			const receiptTpl = getRecruiterSubscriptionEmail({
				recruiterName: userDetails.name || "Recruiter",
				planName: orderPlan.label,
				amountPaid: orderPlan.display,
				paymentId: razorpay_payment_id,
				orderId: razorpay_order_id,
				date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
			});
			await sendEmail(c.env, {
				to: userDetails.email,
				subject: receiptTpl.subject,
				html: receiptTpl.html,
			});
		}
	} catch (err) {
		console.error("[payments] D1 update or email dispatch failed:", String(err));
		// Still return success since the payment itself is verified
	}

	return c.json({
		verified: true,
		order_id: razorpay_order_id,
		payment_id: razorpay_payment_id,
	});
});

// ── GET /api/payments/status ─────────────────────────────────────────────────

payments.get("/status", authenticate(), requireHR(), async (c) => {
	const user = c.get("user");

	try {
		const row = await c.env.DB.prepare(
			`SELECT id, plan, status, signature_verified, created_at
			   FROM payments
			  WHERE user_id = ? AND status = 'paid' AND signature_verified = 1
			  ORDER BY created_at DESC
			  LIMIT 1`
		)
			.bind(user.id)
			.first<{ id: string; plan: string; status: string; signature_verified: number; created_at: string }>();

		if (row) {
			return c.json({ subscribed: true, plan: row.plan, since: row.created_at });
		}
		return c.json({ subscribed: false });
	} catch (err) {
		console.error("[payments] status check failed:", String(err));
		return c.json({ subscribed: false });
	}
});

export default payments;
