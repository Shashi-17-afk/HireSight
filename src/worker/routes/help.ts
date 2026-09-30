import { Hono } from "hono";
import { authenticate } from "../lib/auth";
import type { AuthVariables } from "../lib/auth";
import { evaluateRateLimit } from "../lib/rate-limit";
import {
  HELP_MODEL,
  buildHelpSystemPrompt,
  extractAssistantText,
  normalizeChatTurns,
  type HelpRole,
} from "../lib/prompts/help-chat";

const help = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

help.post("/chat", authenticate(), async (c) => {
  const user = c.get("user");
  const role: HelpRole = user.role === "HR" ? "HR" : "candidate";
  const now = Math.floor(Date.now() / 1000);
  const rlKey = `help:${user.id}`;

  try {
    const rawRl = await c.env.RATE_LIMIT.get(rlKey);
    const decision = evaluateRateLimit({ raw: rawRl, now, limit: 15, windowSecs: 60 });
    if (!decision.allowed) {
      return c.json(
        { error: "Too many chat messages. Please wait a moment.", retryAfter: decision.retryAfter },
        429,
        { "Retry-After": String(decision.retryAfter) }
      );
    }
    if (decision.nextValue) {
      await c.env.RATE_LIMIT.put(rlKey, JSON.stringify(decision.nextValue), {
        expirationTtl: decision.ttlSeconds,
      });
    }
  } catch (rlErr) {
    console.error("[help] rate-limit KV error", String(rlErr));
  }

  let body: { messages?: unknown; path?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const history = normalizeChatTurns(body.messages);
  const last = history[history.length - 1];
  if (!last || last.role !== "user") {
    return c.json({ error: "Send a user message to continue." }, 400);
  }

  const path = typeof body.path === "string" ? body.path.trim().slice(0, 200) : "";
  const messages = [
    { role: "system" as const, content: buildHelpSystemPrompt(role, path) },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
  ];

  try {
    const llmResponse = await c.env.AI.run(
      HELP_MODEL as Parameters<typeof c.env.AI.run>[0],
      { messages, max_tokens: 420 }
    );
    const reply = extractAssistantText(llmResponse);
    if (!reply) {
      return c.json({ error: "The helper could not draft a reply. Try again." }, 502);
    }
    return c.json({ reply });
  } catch (err) {
    console.error("[help] chat model failed", String(err));
    return c.json({ error: "Help chat is temporarily unavailable." }, 502);
  }
});

export default help;
