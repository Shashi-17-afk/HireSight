import { Hono } from "hono";
import type { Context } from "hono";
import { sign } from "hono/jwt";
import { hashPassword, verifyPassword } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";
import { sendEmail } from "../lib/email";
import { KV_MIN_TTL_SECONDS, evaluateRateLimit, parseWindow } from "../lib/rate-limit";
import { getOtpResetEmail, getWelcomeEmail } from "../lib/email-templates";

const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// POST /register/hr
auth.post("/register/hr", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string; password?: string; company_name?: string }>();

  if (!body.name || !body.email || !body.password) {
    return c.json({ error: "name, email, and password are required" }, 400);
  }
  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const userName = body.name.trim();
  const userEmail = body.email.trim().toLowerCase();
  const passwordHash = await hashPassword(body.password);
  const userId = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, role, name, company_name, email, password_hash) VALUES (?, 'HR', ?, ?, ?, ?)"
    )
      .bind(
        userId,
        userName,
        body.company_name?.trim() || null,
        userEmail,
        passwordHash
      )
      .run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed")) {
      return c.json({ error: "Email is already registered" }, 400);
    }
    return c.json({ error: "Failed to create user: " + msg }, 500);
  }

  // Trigger non-blocking Welcome Email for Recruiter
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const welcomeTpl = getWelcomeEmail({
          userName,
          role: "recruiter",
          dashboardUrl: "https://hiresight.shashishanthan2706.workers.dev/hr/dashboard",
        });
        await sendEmail(c.env, {
          to: userEmail,
          subject: welcomeTpl.subject,
          html: welcomeTpl.html,
        });
      } catch (welcomeErr) {
        console.error("[auth] welcome email dispatch error for HR:", String(welcomeErr));
      }
    })()
  );

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: "Server error: JWT_SECRET not configured" }, 500);
  const token = await sign(
    {
      userId,
      role: "HR",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    },
    jwtSecret
  );

  return c.json({ token, role: "HR", name: userName, userId }, 201);
});

// POST /register/candidate
auth.post("/register/candidate", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string; password?: string }>();

  if (!body.name || !body.email || !body.password) {
    return c.json({ error: "name, email, and password are required" }, 400);
  }
  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const userName = body.name.trim();
  const userEmail = body.email.trim().toLowerCase();
  const passwordHash = await hashPassword(body.password);
  const userId = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, role, name, company_name, email, password_hash) VALUES (?, 'candidate', ?, NULL, ?, ?)"
    )
      .bind(
        userId,
        userName,
        userEmail,
        passwordHash
      )
      .run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed")) {
      return c.json({ error: "Email is already registered" }, 400);
    }
    return c.json({ error: "Failed to create user: " + msg }, 500);
  }

  // Trigger non-blocking Welcome Email for Candidate
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const welcomeTpl = getWelcomeEmail({
          userName,
          role: "candidate",
          dashboardUrl: "https://hiresight.shashishanthan2706.workers.dev/candidate/dashboard",
        });
        await sendEmail(c.env, {
          to: userEmail,
          subject: welcomeTpl.subject,
          html: welcomeTpl.html,
        });
      } catch (welcomeErr) {
        console.error("[auth] welcome email dispatch error for Candidate:", String(welcomeErr));
      }
    })()
  );

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: "Server error: JWT_SECRET not configured" }, 500);
  const token = await sign(
    {
      userId,
      role: "candidate",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    },
    jwtSecret
  );

  return c.json({ token, role: "candidate", name: userName, userId }, 201);
});

// POST /login/hr
auth.post("/login/hr", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, name, role, password_hash FROM users WHERE email = ? AND role = 'HR'"
  )
    .bind(body.email.trim().toLowerCase())
    .first<{ id: string; name: string; role: string; password_hash: string }>();

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: "Server error: JWT_SECRET not configured" }, 500);
  const token = await sign(
    {
      userId: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    },
    jwtSecret
  );

  return c.json({ token, role: user.role, name: user.name, userId: user.id });
});

// POST /login/candidate
auth.post("/login/candidate", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, name, role, password_hash FROM users WHERE email = ? AND role = 'candidate'"
  )
    .bind(body.email.trim().toLowerCase())
    .first<{ id: string; name: string; role: string; password_hash: string }>();

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: "Server error: JWT_SECRET not configured" }, 500);
  const token = await sign(
    {
      userId: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    },
    jwtSecret
  );

  return c.json({ token, role: user.role, name: user.name, userId: user.id });
});

// ── Password reset with emailed one-time codes ───────────────────────────────
//
// Brute-force defences:
//  - 6-digit codes (1,000,000 possibilities).
//  - Each code allows OTP_MAX_ATTEMPTS wrong guesses, then is destroyed.
//  - A per-email failure budget (OTP_EMAIL_MAX_FAILURES per OTP_LOCK_SECS)
//    survives across newly requested codes, so requesting fresh codes does
//    not buy fresh guesses.
//  - IP rate limits on requesting codes and on submitting them.

const OTP_DIGITS = 6;
const OTP_TTL_SECS = 600;
const OTP_MAX_ATTEMPTS = 5;
const OTP_EMAIL_MAX_FAILURES = 10;
const OTP_LOCK_SECS = 24 * 60 * 60;
const OTP_RE = new RegExp(`^\\d{${OTP_DIGITS}}$`);

type OtpData = { otp: string; attempts: number; expiresAt: number };

function clientIp(c: Context<{ Bindings: Env; Variables: AuthVariables }>): string {
  return (
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0].trim() ??
    "unknown"
  );
}

/** Fixed-window KV rate limit. Returns seconds to wait when blocked, else null. */
async function hitRateLimit(env: Env, key: string, limit: number, windowSecs: number): Promise<number | null> {
  const now = Math.floor(Date.now() / 1000);
  const decision = evaluateRateLimit({ raw: await env.RATE_LIMIT.get(key), now, limit, windowSecs });
  if (!decision.allowed) return decision.retryAfter;
  if (decision.nextValue) {
    await env.RATE_LIMIT.put(key, JSON.stringify(decision.nextValue), { expirationTtl: decision.ttlSeconds });
  }
  return null;
}

function generateOtp(): string {
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x1_0000_0000 / 10 ** OTP_DIGITS) * 10 ** OTP_DIGITS;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return (buf[0] % 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, "0");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Check a submitted code. Wrong guesses count against both the code and the
 * email's failure budget. The code is NOT consumed on success; the caller
 * deletes it once the password has changed.
 */
async function checkOtp(env: Env, email: string, input: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = Math.floor(Date.now() / 1000);
  const otpKey = `otp:${email}`;
  const failKey = `otp_fail:${email}`;
  const expired = { ok: false as const, error: "Invalid or expired verification code. Please request a new code." };

  const fails = parseWindow(await env.RATE_LIMIT.get(failKey));
  if (fails && fails.expiresAt > now && fails.count >= OTP_EMAIL_MAX_FAILURES) {
    await env.RATE_LIMIT.delete(otpKey);
    return { ok: false, error: "Too many incorrect codes for this account. Please try again in 24 hours." };
  }

  const raw = await env.RATE_LIMIT.get(otpKey);
  if (!raw) return expired;
  let data: OtpData;
  try {
    data = JSON.parse(raw) as OtpData;
  } catch {
    await env.RATE_LIMIT.delete(otpKey);
    return expired;
  }
  // expiresAt is authoritative; KV expiry can lag behind it.
  if (typeof data.otp !== "string" || data.expiresAt <= now) {
    await env.RATE_LIMIT.delete(otpKey);
    return expired;
  }
  if (data.attempts >= OTP_MAX_ATTEMPTS) {
    await env.RATE_LIMIT.delete(otpKey);
    return { ok: false, error: "Too many invalid attempts. This code has been invalidated. Please request a new code." };
  }

  if (safeEqual(data.otp, input)) return { ok: true };

  // Record the failure against the email's budget.
  const activeFails = fails && fails.expiresAt > now ? fails : { count: 0, expiresAt: now + OTP_LOCK_SECS };
  await env.RATE_LIMIT.put(
    failKey,
    JSON.stringify({ count: activeFails.count + 1, expiresAt: activeFails.expiresAt }),
    { expirationTtl: Math.max(KV_MIN_TTL_SECONDS, activeFails.expiresAt - now) }
  );

  data.attempts += 1;
  if (data.attempts >= OTP_MAX_ATTEMPTS) {
    await env.RATE_LIMIT.delete(otpKey);
    return { ok: false, error: "Too many invalid attempts. This code has been invalidated. Please request a new code." };
  }
  await env.RATE_LIMIT.put(otpKey, JSON.stringify(data), {
    expirationTtl: Math.max(KV_MIN_TTL_SECONDS, data.expiresAt - now),
  });
  const remaining = OTP_MAX_ATTEMPTS - data.attempts;
  return { ok: false, error: `Invalid code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.` };
}

// POST /forgot-password (sends a one-time code; rate-limited; anti-enumeration)
auth.post("/forgot-password", async (c) => {
  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.email || !body.email.trim()) {
    return c.json({ error: "Email is required" }, 400);
  }
  const userEmail = body.email.trim().toLowerCase();

  // Max 5 code requests per IP per 15 minutes.
  const ipWait = await hitRateLimit(c.env, `rl:forgot_pw:${clientIp(c)}`, 5, 900);
  if (ipWait !== null) {
    return c.json(
      { error: "Too many password reset requests from this IP. Please wait before trying again.", retryAfter: ipWait },
      429,
      { "Retry-After": String(ipWait) }
    );
  }

  // Max 1 code per email per 60 seconds.
  const emailCooldownKey = `rl:otp_cooldown:${userEmail}`;
  if (await c.env.RATE_LIMIT.get(emailCooldownKey)) {
    return c.json(
      { error: "A verification code was recently sent. Please wait 60 seconds before requesting another." },
      429
    );
  }
  await c.env.RATE_LIMIT.put(emailCooldownKey, "1", { expirationTtl: 60 });

  const genericSuccessMessage = `If an account with that email exists, a ${OTP_DIGITS}-digit verification code has been sent.`;

  const user = await c.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?")
    .bind(userEmail)
    .first<{ id: string; name: string; email: string }>();

  if (user) {
    const otp = generateOtp();
    const now = Math.floor(Date.now() / 1000);
    const otpData: OtpData = { otp, attempts: 0, expiresAt: now + OTP_TTL_SECS };
    await c.env.RATE_LIMIT.put(`otp:${userEmail}`, JSON.stringify(otpData), { expirationTtl: OTP_TTL_SECS });

    try {
      const resetTpl = getOtpResetEmail({ userName: user.name, otp, expiresInMinutes: OTP_TTL_SECS / 60 });
      await sendEmail(c.env, { to: user.email, subject: resetTpl.subject, html: resetTpl.html });
    } catch (emailErr) {
      console.error("[auth] OTP email dispatch error:", String(emailErr));
    }
  }

  return c.json({ message: genericSuccessMessage });
});

// POST /verify-otp (checks a code without changing the password)
auth.post("/verify-otp", async (c) => {
  let body: { email?: string; otp?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.email || !body.otp) {
    return c.json({ error: "Email and OTP code are required" }, 400);
  }
  const userEmail = body.email.trim().toLowerCase();
  const inputOtp = body.otp.trim();
  if (!OTP_RE.test(inputOtp)) {
    return c.json({ error: `OTP code must be exactly ${OTP_DIGITS} digits` }, 400);
  }

  const ipWait = await hitRateLimit(c.env, `rl:otp_check:${clientIp(c)}`, 20, 900);
  if (ipWait !== null) {
    return c.json({ error: "Too many attempts. Please wait before trying again.", retryAfter: ipWait }, 429, {
      "Retry-After": String(ipWait),
    });
  }

  const result = await checkOtp(c.env, userEmail, inputOtp);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ valid: true, message: "Code verified successfully" });
});

// POST /reset-password (sets a new password using a one-time code)
auth.post("/reset-password", async (c) => {
  let body: { email?: string; otp?: string; new_password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.new_password) {
    return c.json({ error: "New password is required" }, 400);
  }
  if (body.new_password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters long" }, 400);
  }
  if (!body.email || !body.otp) {
    return c.json({ error: "Email and verification code are required" }, 400);
  }

  const userEmail = body.email.trim().toLowerCase();
  const inputOtp = body.otp.trim();
  if (!OTP_RE.test(inputOtp)) {
    return c.json({ error: `Verification code must be ${OTP_DIGITS} digits` }, 400);
  }

  const ipWait = await hitRateLimit(c.env, `rl:otp_check:${clientIp(c)}`, 20, 900);
  if (ipWait !== null) {
    return c.json({ error: "Too many attempts. Please wait before trying again.", retryAfter: ipWait }, 429, {
      "Retry-After": String(ipWait),
    });
  }

  const result = await checkOtp(c.env, userEmail, inputOtp);
  if (!result.ok) return c.json({ error: result.error }, 400);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(userEmail)
    .first<{ id: string }>();
  // Codes are only issued for existing accounts, so this is a deleted user.
  if (!user) {
    await c.env.RATE_LIMIT.delete(`otp:${userEmail}`);
    return c.json({ error: "Invalid or expired verification code. Please request a new code." }, 400);
  }

  const newHash = await hashPassword(body.new_password);
  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, user.id).run();

  // Single use.
  await c.env.RATE_LIMIT.delete(`otp:${userEmail}`);

  return c.json({ message: "Password updated successfully! You can now log in with your new password." });
});

export default auth;

