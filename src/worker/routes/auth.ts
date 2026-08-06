import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { hashPassword, verifyPassword } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";
import { sendEmail } from "../lib/email";
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

// POST /forgot-password (Sends 4-digit OTP, Rate-limited, Anti-enumeration)
auth.post("/forgot-password", async (c) => {
  const body = await c.req.json<{ email?: string }>();

  if (!body.email || !body.email.trim()) {
    return c.json({ error: "Email is required" }, 400);
  }

  const userEmail = body.email.trim().toLowerCase();

  // --- IP Rate Limiting: Max 5 reset requests per IP per 15 minutes ---
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0].trim() ??
    "unknown";
  const rlKey = `rl:forgot_pw:${ip}`;

  const rawRl = await c.env.RATE_LIMIT.get(rlKey);
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  let expiresAt = now + 900; // 15 mins window

  if (rawRl) {
    try {
      const stored = JSON.parse(rawRl) as { count: number; expiresAt: number };
      count = stored.count;
      expiresAt = stored.expiresAt;
    } catch {
      // Fallback if parsing fails
    }
  }

  if (count >= 5) {
    const retryAfter = Math.max(1, expiresAt - now);
    return c.json(
      { error: "Too many password reset requests from this IP. Please wait before trying again.", retryAfter },
      429,
      { "Retry-After": String(retryAfter) }
    );
  }

  const ttlSeconds = Math.max(1, expiresAt - now);
  await c.env.RATE_LIMIT.put(rlKey, JSON.stringify({ count: count + 1, expiresAt }), { expirationTtl: ttlSeconds });

  // --- Email Cooldown: Max 1 OTP request per email per 60 seconds ---
  const emailCooldownKey = `rl:otp_cooldown:${userEmail}`;
  const inCooldown = await c.env.RATE_LIMIT.get(emailCooldownKey);
  if (inCooldown) {
    return c.json(
      { error: "A verification code was recently sent. Please wait 60 seconds before requesting another." },
      429
    );
  }
  // Set 60 second cooldown for email
  await c.env.RATE_LIMIT.put(emailCooldownKey, "1", { expirationTtl: 60 });

  // Generate cryptographically secure 4-digit OTP (1000 - 9999)
  const randomBuffer = new Uint16Array(1);
  crypto.getRandomValues(randomBuffer);
  const otp = (1000 + (randomBuffer[0] % 9000)).toString();

  // Store OTP in KV store with 10-minute TTL (600s) and attempt tracking
  const otpKey = `otp:${userEmail}`;
  const otpData = {
    otp,
    attempts: 0,
    expiresAt: now + 600,
    email: userEmail,
  };
  await c.env.RATE_LIMIT.put(otpKey, JSON.stringify(otpData), { expirationTtl: 600 });

  // Security Note: Non-enumerating response — generic success message
  const genericSuccessMessage = "If an account with that email exists, a 4-digit verification code has been sent.";

  const user = await c.env.DB.prepare(
    "SELECT id, name, email FROM users WHERE email = ?"
  )
    .bind(userEmail)
    .first<{ id: string; name: string; email: string }>();

  if (user) {
    try {
      const resetTpl = getOtpResetEmail({
        userName: user.name,
        otp,
        expiresInMinutes: 10,
      });

      await sendEmail(c.env, {
        to: user.email,
        subject: resetTpl.subject,
        html: resetTpl.html,
      });
    } catch (emailErr) {
      console.error("[auth] OTP email dispatch error:", String(emailErr));
    }
  }

  return c.json({ message: genericSuccessMessage });
});

// POST /verify-otp (Validates 4-digit OTP code without changing password yet)
auth.post("/verify-otp", async (c) => {
  const body = await c.req.json<{ email?: string; otp?: string }>();

  if (!body.email || !body.otp) {
    return c.json({ error: "Email and OTP code are required" }, 400);
  }

  const userEmail = body.email.trim().toLowerCase();
  const inputOtp = body.otp.trim();

  if (!/^\d{4}$/.test(inputOtp)) {
    return c.json({ error: "OTP code must be exactly 4 digits" }, 400);
  }

  const otpKey = `otp:${userEmail}`;
  const rawOtpData = await c.env.RATE_LIMIT.get(otpKey);

  if (!rawOtpData) {
    return c.json({ error: "Invalid or expired verification code. Please request a new code." }, 400);
  }

  type OtpData = { otp: string; attempts: number; expiresAt: number; email: string };
  let otpData: OtpData;
  try {
    otpData = JSON.parse(rawOtpData) as OtpData;
  } catch {
    return c.json({ error: "Invalid verification state. Please request a new code." }, 400);
  }

  if (otpData.attempts >= 5) {
    await c.env.RATE_LIMIT.delete(otpKey);
    return c.json(
      { error: "Too many invalid attempts. This code has been invalidated for security. Please request a new code." },
      400
    );
  }

  if (otpData.otp !== inputOtp) {
    otpData.attempts += 1;
    const remainingAttempts = 5 - otpData.attempts;
    const remainingTtl = Math.max(1, otpData.expiresAt - Math.floor(Date.now() / 1000));

    if (otpData.attempts >= 5) {
      await c.env.RATE_LIMIT.delete(otpKey);
      return c.json(
        { error: "Too many invalid attempts. This code has been invalidated for security. Please request a new code." },
        400
      );
    } else {
      await c.env.RATE_LIMIT.put(otpKey, JSON.stringify(otpData), { expirationTtl: remainingTtl });
      return c.json(
        { error: `Invalid code. You have ${remainingAttempts} ${remainingAttempts === 1 ? "attempt" : "attempts"} remaining.` },
        400
      );
    }
  }

  return c.json({ valid: true, message: "Code verified successfully" });
});

// POST /reset-password (Resets password using 4-digit OTP or legacy token)
auth.post("/reset-password", async (c) => {
  const body = await c.req.json<{ email?: string; otp?: string; token?: string; new_password?: string }>();

  if (!body.new_password) {
    return c.json({ error: "New password is required" }, 400);
  }

  if (body.new_password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters long" }, 400);
  }

  // --- OTP Flow (4-Digit Code) ---
  if (body.email && body.otp) {
    const userEmail = body.email.trim().toLowerCase();
    const inputOtp = body.otp.trim();

    if (!/^\d{4}$/.test(inputOtp)) {
      return c.json({ error: "Verification code must be 4 digits" }, 400);
    }

    const otpKey = `otp:${userEmail}`;
    const rawOtpData = await c.env.RATE_LIMIT.get(otpKey);

    if (!rawOtpData) {
      return c.json({ error: "Invalid or expired verification code. Please request a new code." }, 400);
    }

    type OtpData = { otp: string; attempts: number; expiresAt: number; email: string };
    let otpData: OtpData;
    try {
      otpData = JSON.parse(rawOtpData) as OtpData;
    } catch {
      return c.json({ error: "Invalid verification state. Please request a new code." }, 400);
    }

    if (otpData.attempts >= 5) {
      await c.env.RATE_LIMIT.delete(otpKey);
      return c.json(
        { error: "Too many invalid attempts. This code has been invalidated for security. Please request a new code." },
        400
      );
    }

    if (otpData.otp !== inputOtp) {
      otpData.attempts += 1;
      const remainingAttempts = 5 - otpData.attempts;
      const remainingTtl = Math.max(1, otpData.expiresAt - Math.floor(Date.now() / 1000));

      if (otpData.attempts >= 5) {
        await c.env.RATE_LIMIT.delete(otpKey);
        return c.json(
          { error: "Too many invalid attempts. This code has been invalidated. Please request a new code." },
          400
        );
      } else {
        await c.env.RATE_LIMIT.put(otpKey, JSON.stringify(otpData), { expirationTtl: remainingTtl });
        return c.json(
          { error: `Invalid code. ${remainingAttempts} ${remainingAttempts === 1 ? "attempt" : "attempts"} remaining.` },
          400
        );
      }
    }

    // OTP matched! Verify user exists in DB
    const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(userEmail)
      .first<{ id: string }>();

    if (!user) {
      await c.env.RATE_LIMIT.delete(otpKey);
      return c.json({ error: "Account not found for this email address" }, 404);
    }

    // Hash new password and update in D1
    const newHash = await hashPassword(body.new_password);
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(newHash, user.id)
      .run();

    // Consume single-use OTP key from KV
    await c.env.RATE_LIMIT.delete(otpKey);

    return c.json({ message: "Password updated successfully! You can now log in with your new password." });
  }

  // --- Legacy Token Flow ---
  if (body.token) {
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return c.json({ error: "Server error: JWT_SECRET not configured" }, 500);

    try {
      const payload = await verify(body.token, jwtSecret, "HS256");

      if (payload.purpose !== "password_reset" || !payload.userId || !payload.pwdSig) {
        return c.json({ error: "Invalid password reset token" }, 400);
      }

      const user = await c.env.DB.prepare(
        "SELECT id, password_hash FROM users WHERE id = ?"
      )
        .bind(payload.userId)
        .first<{ id: string; password_hash: string }>();

      if (!user) {
        return c.json({ error: "User no longer exists" }, 400);
      }

      if (user.password_hash.slice(-12) !== payload.pwdSig) {
        return c.json({ error: "Password reset link has already been used or is expired" }, 400);
      }

      const newHash = await hashPassword(body.new_password);
      await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(newHash, user.id)
        .run();

      return c.json({ message: "Password updated successfully! You can now log in with your new password." });
    } catch (err: unknown) {
      console.error("[auth] reset-password token error:", String(err));
      return c.json({ error: "Invalid or expired password reset token" }, 400);
    }
  }

  return c.json({ error: "Email & OTP code or reset token is required" }, 400);
});

export default auth;

