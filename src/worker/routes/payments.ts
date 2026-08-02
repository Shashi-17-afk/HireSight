import { Hono } from "hono";
import { authenticate, requireHR } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";

const payments = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an ArrayBuffer to a lowercase hex string. */
function bufToHex(buf: ArrayBuffer): string {
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
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

// ── POST /api/payments/create-order ──────────────────────────────────────────

payments.post("/create-order", authenticate(), requireHR(), async (c) => {
	const body = await c.req.json<{ amount?: number; currency?: string; plan?: string }>();
	const user = c.get("user");

	const amount = body.amount ?? 409900; // default ₹4,099 in paise
	const currency = body.currency ?? "INR";
	const plan = body.plan ?? "growth";

	// Validate minimum amount (Razorpay requires >= 100 paise)
	if (typeof amount !== "number" || amount < 100) {
		return c.json({ error: "Amount must be at least 100 paise (₹1)" }, 400);
	}

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
		// Non-fatal: order was already created on Razorpay, still return it
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

	const keySecret = c.env.RAZORPAY_KEY_SECRET;
	if (!keySecret) {
		return c.json({ error: "Payment gateway not configured" }, 500);
	}

	// Verify HMAC-SHA256 signature: HMAC(order_id|payment_id, secret)
	const expectedSignature = await hmacSha256(
		`${razorpay_order_id}|${razorpay_payment_id}`,
		keySecret
	);

	if (expectedSignature !== razorpay_signature) {
		console.error("[payments] Signature mismatch for order", razorpay_order_id);
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
			  WHERE razorpay_order_id = ?`
		)
			.bind(razorpay_payment_id, razorpay_order_id)
			.run();
	} catch (err) {
		console.error("[payments] D1 update failed:", String(err));
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
