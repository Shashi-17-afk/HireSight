import { Hono } from "hono";
import { sign } from "hono/jwt";
import { hashPassword, verifyPassword } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";

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

  const passwordHash = await hashPassword(body.password);
  const userId = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, role, name, company_name, email, password_hash) VALUES (?, 'HR', ?, ?, ?, ?)"
    )
      .bind(
        userId,
        body.name.trim(),
        body.company_name?.trim() || null,
        body.email.trim().toLowerCase(),
        passwordHash
      )
      .run();
  } catch (err: any) {
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return c.json({ error: "Email is already registered" }, 400);
    }
    return c.json({ error: "Failed to create user: " + err.message }, 500);
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: "Server error: JWT_SECRET not configured" }, 500);
  const token = await sign(
    {
      userId,
      role: "HR",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
    },
    jwtSecret
  );

  return c.json({ token, role: "HR", name: body.name.trim(), userId }, 201);
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

  const passwordHash = await hashPassword(body.password);
  const userId = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, role, name, company_name, email, password_hash) VALUES (?, 'candidate', ?, NULL, ?, ?)"
    )
      .bind(
        userId,
        body.name.trim(),
        body.email.trim().toLowerCase(),
        passwordHash
      )
      .run();
  } catch (err: any) {
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return c.json({ error: "Email is already registered" }, 400);
    }
    return c.json({ error: "Failed to create user: " + err.message }, 500);
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: "Server error: JWT_SECRET not configured" }, 500);
  const token = await sign(
    {
      userId,
      role: "candidate",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
    },
    jwtSecret
  );

  return c.json({ token, role: "candidate", name: body.name.trim(), userId }, 201);
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
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
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
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
    },
    jwtSecret
  );

  return c.json({ token, role: user.role, name: user.name, userId: user.id });
});

export default auth;
