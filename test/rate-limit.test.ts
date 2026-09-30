import { describe, expect, it } from "vitest";
import {
	KV_MIN_TTL_SECONDS,
	evaluateRateLimit,
	parseWindow,
} from "../src/worker/lib/rate-limit";

const LIMIT = 5;
const WINDOW = 60;
const NOW = 1_000_000;

function evaluate(raw: string | null, now = NOW) {
	return evaluateRateLimit({ raw, now, limit: LIMIT, windowSecs: WINDOW });
}

describe("parseWindow", () => {
	it("returns null for an absent value", () => {
		expect(parseWindow(null)).toBeNull();
	});

	it("returns null for malformed JSON rather than throwing", () => {
		expect(parseWindow("{not json")).toBeNull();
	});

	it("returns null when fields are the wrong type", () => {
		expect(parseWindow('{"count":"3","expiresAt":123}')).toBeNull();
		expect(parseWindow('{"count":3}')).toBeNull();
	});

	it("parses a well-formed window", () => {
		expect(parseWindow('{"count":3,"expiresAt":123}')).toEqual({ count: 3, expiresAt: 123 });
	});
});

describe("evaluateRateLimit — TTL never drops below the KV minimum", () => {
	// The regression: the second request in a window used to compute a TTL of
	// ~55s, which KV rejects outright, turning the request into a 500.
	it("uses the full window as the TTL 5 seconds into the window", () => {
		const raw = JSON.stringify({ count: 1, expiresAt: NOW + 55 });
		const d = evaluate(raw);
		expect(d.allowed).toBe(true);
		expect(d.ttlSeconds).toBe(WINDOW);
		expect(d.ttlSeconds).toBeGreaterThanOrEqual(KV_MIN_TTL_SECONDS);
	});

	it("uses a valid TTL with only 1 second left in the window", () => {
		const raw = JSON.stringify({ count: 2, expiresAt: NOW + 1 });
		const d = evaluate(raw);
		expect(d.ttlSeconds).toBeGreaterThanOrEqual(KV_MIN_TTL_SECONDS);
	});

	it("never returns a sub-minimum TTL at any point in the window", () => {
		for (let remaining = 1; remaining <= WINDOW; remaining++) {
			const raw = JSON.stringify({ count: 1, expiresAt: NOW + remaining });
			expect(evaluate(raw).ttlSeconds).toBeGreaterThanOrEqual(KV_MIN_TTL_SECONDS);
		}
	});
});

describe("evaluateRateLimit — counting", () => {
	it("starts a new window on a first request", () => {
		const d = evaluate(null);
		expect(d.allowed).toBe(true);
		expect(d.nextValue).toEqual({ count: 1, expiresAt: NOW + WINDOW });
	});

	it("increments without moving the window end", () => {
		const raw = JSON.stringify({ count: 2, expiresAt: NOW + 40 });
		const d = evaluate(raw);
		expect(d.nextValue).toEqual({ count: 3, expiresAt: NOW + 40 });
	});

	it("allows exactly `limit` requests per window", () => {
		let raw: string | null = null;
		for (let i = 1; i <= LIMIT; i++) {
			const d = evaluate(raw);
			expect(d.allowed).toBe(true);
			expect(d.nextValue?.count).toBe(i);
			raw = JSON.stringify(d.nextValue);
		}
		expect(evaluate(raw).allowed).toBe(false);
	});

	it("blocks once the count reaches the limit, and writes nothing", () => {
		const raw = JSON.stringify({ count: LIMIT, expiresAt: NOW + 30 });
		const d = evaluate(raw);
		expect(d.allowed).toBe(false);
		expect(d.nextValue).toBeNull();
		expect(d.retryAfter).toBe(30);
	});

	it("reports a retryAfter of 1 second at the very end of the window", () => {
		// A blocked request always has a live window, so retryAfter is never below 1.
		const raw = JSON.stringify({ count: LIMIT, expiresAt: NOW + 1 });
		const d = evaluate(raw);
		expect(d.allowed).toBe(false);
		expect(d.retryAfter).toBe(1);
	});
});

describe("evaluateRateLimit — stale keys", () => {
	// The TTL now outlives the window, so an elapsed window must not keep
	// blocking the caller.
	it("starts a fresh window when the stored window has elapsed", () => {
		const raw = JSON.stringify({ count: LIMIT, expiresAt: NOW - 1 });
		const d = evaluate(raw);
		expect(d.allowed).toBe(true);
		expect(d.nextValue).toEqual({ count: 1, expiresAt: NOW + WINDOW });
	});

	it("treats a window expiring exactly now as elapsed", () => {
		const raw = JSON.stringify({ count: LIMIT, expiresAt: NOW });
		expect(evaluate(raw).allowed).toBe(true);
	});

	it("falls back to a fresh window on a corrupt stored value", () => {
		const d = evaluate("garbage");
		expect(d.allowed).toBe(true);
		expect(d.nextValue).toEqual({ count: 1, expiresAt: NOW + WINDOW });
	});
});
