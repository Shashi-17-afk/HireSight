import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";
import { LeaderboardDO } from "./leaderboard-do";
import jobs from "./routes/jobs";
import candidates from "./routes/candidates";
import auth from "./routes/auth";
import profile from "./routes/profile";
import { authenticate, requireHR } from "./lib/auth";
import type { AuthVariables } from "./lib/auth";

export { LeaderboardDO };

type AppEnv = { Bindings: Env; Variables: AuthVariables };

const app = new Hono<AppEnv>();

app.use(
	"/api/*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	})
);

// Health check (public)
app.get("/api/health", (c) => c.json({ status: "ok", service: "hiresight" }));

// Auth — register + login (public)
app.route("/api/auth", auth);

// Jobs — POST requires HR auth; GET / and GET /:id are public
app.route("/api/jobs", jobs);

// Candidates — GET /my-applications requires candidate auth; POST is public
app.route("/api/candidates", candidates);

// Candidate profile — GET + PUT require candidate auth
app.route("/api/profile", profile);

// WebSocket leaderboard — HR only.
// Browsers cannot send custom headers on WS upgrades, so the JWT is passed
// as a ?token= query param and validated inline here.
app.get("/api/leaderboard/:job_id/ws", async (c) => {
	const jobId = c.req.param("job_id");
	const token = c.req.query("token");

	if (!token) return c.text("Unauthorized: Missing token", 401);

	const jwtSecret = c.env.JWT_SECRET;
	if (!jwtSecret) return c.text("Server error: JWT_SECRET not configured", 500);

	try {
		const payload = await verify(token, jwtSecret, "HS256");
		if (!payload.userId || payload.role !== "HR") {
			return c.text("Forbidden: HR access required", 403);
		}
	} catch {
		return c.text("Unauthorized: Invalid or expired token", 401);
	}

	const doId = c.env.LEADERBOARD.idFromName(jobId);
	const stub = c.env.LEADERBOARD.get(doId);
	return stub.fetch(c.req.raw);
});

// REST snapshot — HR only via Bearer token
app.get("/api/leaderboard/:job_id", authenticate(), requireHR(), async (c) => {
	const jobId = c.req.param("job_id");
	const doId = c.env.LEADERBOARD.idFromName(jobId);
	const stub = c.env.LEADERBOARD.get(doId);
	const url = new URL(c.req.url);
	url.pathname = "/snapshot";
	return stub.fetch(new Request(url.toString(), { method: "GET" }));
});

export default app;
