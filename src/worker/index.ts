import { Hono } from "hono";
import { cors } from "hono/cors";
import { LeaderboardDO } from "./leaderboard-do";
import jobs from "./routes/jobs";
import candidates from "./routes/candidates";
import auth from "./routes/auth";
import { authenticate, requireHR } from "./lib/auth";
import type { AuthVariables } from "./lib/auth";

export { LeaderboardDO };

type AppEnv = { Bindings: Env; Variables: AuthVariables };

const app = new Hono<AppEnv>();

// CORS — allow frontend (any origin in dev, lock down in prod)
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "hiresight" })
);

// Auth endpoints
app.route("/api/auth", auth);

// Job creation
app.route("/api/jobs", jobs);

// Candidate submission + AI scoring
app.route("/api/candidates", candidates);

// WebSocket endpoint — proxies upgrade to the LeaderboardDO for a given job
// Frontend connects to: ws://host/api/leaderboard/:job_id/ws?token=<token>
app.get("/api/leaderboard/:job_id/ws", async (c) => {
  const jobId = c.req.param("job_id");
  const token = c.req.query("token");
  if (!token) {
    return c.text("Unauthorized: Missing token", 401);
  }

  const jwtSecret = c.env.JWT_SECRET || "default_jwt_secret_key_please_change";
  try {
    const { verify } = await import("hono/jwt");
    const payload = await verify(token, jwtSecret, "HS256");
    if (!payload.userId || payload.role !== "HR") {
      return c.text("Forbidden: HR access required", 403);
    }
  } catch {
    return c.text("Unauthorized: Invalid token", 401);
  }

  const doId = c.env.LEADERBOARD.idFromName(jobId);
  const stub = c.env.LEADERBOARD.get(doId);
  return stub.fetch(c.req.raw);
});

// REST snapshot — useful for initial page load without WebSocket
app.get("/api/leaderboard/:job_id", authenticate(), requireHR(), async (c) => {
  const jobId = c.req.param("job_id");
  const doId = c.env.LEADERBOARD.idFromName(jobId);
  const stub = c.env.LEADERBOARD.get(doId);
  const url = new URL(c.req.url);
  url.pathname = "/snapshot";
  return stub.fetch(new Request(url.toString(), { method: "GET" }));
});

export default app;

