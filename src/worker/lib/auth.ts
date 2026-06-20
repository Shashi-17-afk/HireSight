import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";

export type AuthVariables = {
  user: {
    id: string;
    role: string;
  };
};

export const authenticate = () =>
  createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized: Missing or malformed token" }, 401);
    }
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || "default_jwt_secret_key_please_change";
    try {
      const payload = await verify(token, jwtSecret, "HS256");
      if (!payload.userId || !payload.role) {
        return c.json({ error: "Unauthorized: Invalid token payload" }, 401);
      }
      c.set("user", {
        id: String(payload.userId),
        role: String(payload.role),
      });
      await next();
    } catch {
      return c.json({ error: "Unauthorized: Token expired or invalid" }, 401);
    }
  });

export const requireHR = () =>
  createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!user || user.role !== "HR") {
      return c.json({ error: "Forbidden: HR access required" }, 403);
    }
    await next();
  });

export const requireCandidate = () =>
  createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!user || user.role !== "candidate") {
      return c.json({ error: "Forbidden: Candidate access required" }, 403);
    }
    await next();
  });

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordBuffer = new TextEncoder().encode(password);
  const importKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey", "deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    importKey,
    256
  );
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const passwordBuffer = new TextEncoder().encode(password);
  const importKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey", "deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    importKey,
    256
  );
  const newHashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex === newHashHex;
}
