import { Hono } from "hono";
import { cors } from "hono/cors";
import { LeaderboardDO } from "./leaderboard-do";
import jobs from "./routes/jobs";
import candidates from "./routes/candidates";

export { LeaderboardDO };

const app = new Hono<{ Bindings: Env }>();

// CORS — allow frontend (any origin in dev, lock down in prod)
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "hiring-screener" })
);

// Job creation
app.route("/api/jobs", jobs);

// Candidate submission + AI scoring
app.route("/api/candidates", candidates);

// WebSocket endpoint — proxies upgrade to the LeaderboardDO for a given job
// Frontend connects to: ws://host/api/leaderboard/:job_id/ws
app.get("/api/leaderboard/:job_id/ws", async (c) => {
  const jobId = c.req.param("job_id");
  const doId = c.env.LEADERBOARD.idFromName(jobId);
  const stub = c.env.LEADERBOARD.get(doId);
  return stub.fetch(c.req.raw);
});

// REST snapshot — useful for initial page load without WebSocket
app.get("/api/leaderboard/:job_id", async (c) => {
  const jobId = c.req.param("job_id");
  const doId = c.env.LEADERBOARD.idFromName(jobId);
  const stub = c.env.LEADERBOARD.get(doId);
  const url = new URL(c.req.url);
  url.pathname = "/snapshot";
  return stub.fetch(new Request(url.toString(), { method: "GET" }));
});

export default app;
