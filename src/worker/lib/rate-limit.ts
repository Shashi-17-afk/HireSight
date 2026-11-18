/**
 * Fixed-window IP rate limiting on top of Workers KV.
 *
 * Two KV constraints shape this:
 *
 *  1. KV rejects any expirationTtl below 60 seconds. Writing the *remaining*
 *     window as the TTL therefore throws on every request after the first
 *     ("Invalid expiration_ttl of 55"), which surfaced as an uncaught 500.
 *     The key is always written with the full window as its TTL instead.
 *
 *  2. Because the TTL can outlive the window, KV expiry cannot be the only
 *     thing ending a window. `expiresAt` inside the stored value is
 *     authoritative: a key that outlives its window starts a fresh one.
 */

export interface RateLimitWindow {
	count: number;
	expiresAt: number;
}

export interface RateLimitDecision {
	allowed: boolean;
	/** Seconds until the current window ends. Only meaningful when blocked. */
	retryAfter: number;
	/** Value to write back to KV. Null when blocked — no write is needed. */
	nextValue: RateLimitWindow | null;
	/** TTL for the write. Never below the KV minimum of 60. */
	ttlSeconds: number;
}

export const KV_MIN_TTL_SECONDS = 60;

/** Parse a stored window, tolerating corrupt or absent values. */
export function parseWindow(raw: string | null): RateLimitWindow | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<RateLimitWindow>;
		if (typeof parsed?.count !== "number" || typeof parsed?.expiresAt !== "number") {
			return null;
		}
		return { count: parsed.count, expiresAt: parsed.expiresAt };
	} catch {
		return null;
	}
}

/**
 * Decide whether a request is allowed and what to persist. Pure — unit tested
 * without a KV binding.
 */
export function evaluateRateLimit(opts: {
	raw: string | null;
	now: number;
	limit: number;
	windowSecs: number;
}): RateLimitDecision {
	const { raw, now, limit, windowSecs } = opts;

	const stored = parseWindow(raw);

	// A stored window that has already elapsed is ignored: KV may not have
	// garbage-collected the key yet, and reusing its count would block the
	// caller for longer than the window.
	const active = stored && stored.expiresAt > now ? stored : null;

	const count = active ? active.count : 0;
	const expiresAt = active ? active.expiresAt : now + windowSecs;

	if (count >= limit) {
		return {
			allowed: false,
			retryAfter: Math.max(1, expiresAt - now),
			nextValue: null,
			ttlSeconds: KV_MIN_TTL_SECONDS,
		};
	}

	return {
		allowed: true,
		retryAfter: 0,
		nextValue: { count: count + 1, expiresAt },
		// Full window, never the remainder — see note above.
		ttlSeconds: Math.max(KV_MIN_TTL_SECONDS, windowSecs),
	};
}

/**
 * Apply a fixed-window limit backed by KV. Returns the seconds to wait when
 * blocked, or null when the request is allowed. KV errors fail open so a
 * KV outage doesn't take the endpoint down.
 */
export async function enforceRateLimit(
	kv: KVNamespace,
	key: string,
	limit: number,
	windowSecs: number
): Promise<number | null> {
	try {
		const decision = evaluateRateLimit({
			raw: await kv.get(key),
			now: Math.floor(Date.now() / 1000),
			limit,
			windowSecs,
		});
		if (!decision.allowed) return decision.retryAfter;
		if (decision.nextValue) {
			await kv.put(key, JSON.stringify(decision.nextValue), { expirationTtl: decision.ttlSeconds });
		}
	} catch (err) {
		console.error("[rate-limit] KV error for", key, String(err));
	}
	return null;
}

/** Best-effort client IP for per-IP limits. */
export function clientIp(header: (name: string) => string | undefined): string {
	return header("CF-Connecting-IP") ?? header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";
}
