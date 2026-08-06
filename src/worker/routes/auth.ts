import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { hashPassword, verifyPassword } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";
import { sendEmail } from "../lib/email";
import { getPasswordResetEmail, getWelcomeEmail } from "../lib/email-templates";

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

// POST /forgot-password (Rate-limited, anti-enumeration, single-use token)
auth.post("/forgot-password", async (c) => {
  const body = await c.req.json<{ email?: string }>();

  if (!body.email || !body.email.trim()) {
    return c.json({ error: "email is required" }, 400);
  }

  // --- Rate Limiting: 5 reset requests per IP per 15 minutes ---
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
      { error: "Too many password reset requests. Please wait before trying again.", retryAfter },
      429,
      { "Retry-After": String(retryAfter) }
    );
  }

  const ttlSeconds = Math.max(1, expiresAt - now);
  await c.env.RATE_LIMIT.put(rlKey, JSON.stringify({ count: count + 1, expiresAt }), { expirationTtl: ttlSeconds });

  // Security Note: Non-enumerating response — always return 200 generic message
  const genericSuccessMessage = "If an account with that email exists, a password reset link has been sent.";

  const user = await c.env.DB.prepare(
    "SELECT id, name, email, password_hash FROM users WHERE email = ?"
  )
    .bind(body.email.trim().toLowerCase())
    .first<{ id: string; name: string; email: string; password_hash: string }>();

  if (user && c.env.JWT_SECRET) {
    try {
      // Bind current password_hash substring into payload to enforce single-use
      const pwdSig = user.password_hash.slice(-12);
      const resetToken = await sign(
        {
          userId: user.id,
          purpose: "password_reset",
          pwdSig,
          exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
        },
        c.env.JWT_SECRET
      );

      const resetUrl = `https://hiresight.shashishanthan2706.workers.dev/reset-password?token=${encodeURIComponent(resetToken)}`;
      const resetTpl = getPasswordResetEmail({
        userName: user.name,
        resetUrl,
        expiresInMinutes: 60,
      });

      await sendEmail(c.env, {
        to: user.email,
        subject: resetTpl.subject,
        html: resetTpl.html,
      });
    } catch (emailErr) {
      console.error("[auth] password reset email dispatch error:", String(emailErr));
    }
  }

  return c.json({ message: genericSuccessMessage });
});

// POST /reset-password
auth.post("/reset-password", async (c) => {
  const body = await c.req.json<{ token?: string; new_password?: string }>();

  if (!body.token || !body.new_password) {
    return c.json({ error: "token and new_password are required" }, 400);
  }

  if (body.new_password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

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

    // Verify single-use signature against current password_hash
    if (user.password_hash.slice(-12) !== payload.pwdSig) {
      return c.json({ error: "Password reset link has already been used or is expired" }, 400);
    }

    // Hash new password and update in D1 (this invalidates the token payload.pwdSig automatically!)
    const newHash = await hashPassword(body.new_password);
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(newHash, user.id)
      .run();

    return c.json({ message: "Password updated successfully. You can now log in with your new password." });
  } catch (err: unknown) {
    console.error("[auth] reset-password token error:", String(err));
    return c.json({ error: "Invalid or expired password reset token" }, 400);
  }
});

export default auth;

