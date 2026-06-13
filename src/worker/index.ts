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

export default app;
