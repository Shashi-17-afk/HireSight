export const HELP_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast" as const;

export type HelpRole = "HR" | "candidate";
export type ChatTurn = { role: "user" | "assistant"; content: string };

const PRODUCT_FACTS = `HireSight is an AI hiring product on Cloudflare. It does not have payroll, attendance, employee records, or an approval queue. Jobs go live as soon as they are published.

Recruiter (HR) screens:
- /hr/dashboard — KPIs, pipeline, recent activity, AI shortlists (score 80+)
- /hr/jobs — job requisitions table; copy apply link; open live leaderboard; delete a job
- /hr/jobs/new — AI Job Description Creator: fill title (required) and role facts, Generate with AI, edit the draft, Use This Description to publish
- /dashboard/:job_id — live candidate leaderboard for one job (WebSocket)
- /hr/candidates — all applicants; filter by stage; pipeline board
- /hr/candidate/:id?job_id= — profile, AI score/reasoning, status updates
Pipeline statuses: applied, under_review, shortlisted, interview, hired, rejected
Send Offer marks a candidate hired (and emails them if they have an account)
Anonymous apply-link candidates cannot have status updated
Posted times are stored in UTC and shown as relative time

Candidate screens:
- Complete profile at /candidate/profile before applying from the jobs board
- /jobs and /jobs/:id — browse openings
- /apply/:job_id — paste resume; Workers AI scores 0–100 vs the JD
- /candidate/dashboard — applications, AI feedback, status

Score guide: 80+ strong fit / auto-shortlist, 50–79 potential, below 50 weak fit.`;

export function buildHelpSystemPrompt(role: HelpRole, path: string): string {
  const audience = role === "HR" ? "a recruiter using the HireSight workspace" : "a candidate using HireSight";
  return `You are HireSight Helper, a concise in-app assistant for ${audience}.
Answer only about HireSight hiring workflows. If something is not in PRODUCT_FACTS, say you are not sure and point them to the closest screen. Never invent buttons, prices, or data changes. You cannot update jobs or statuses yourself — tell the user which screen and button to use. Keep answers short (under 120 words). Use plain language. If useful, mention the path.

Current page: ${path || "unknown"}
User role: ${role}

PRODUCT_FACTS
${PRODUCT_FACTS}
END_PRODUCT_FACTS`;
}

export function normalizeChatTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const role = rec.role === "assistant" ? "assistant" : rec.role === "user" ? "user" : null;
    const content = typeof rec.content === "string" ? rec.content.trim().slice(0, 800) : "";
    if (!role || !content) continue;
    turns.push({ role, content });
    if (turns.length >= 16) break;
  }
  return turns;
}

export function extractAssistantText(resp: unknown): string | null {
  if (!resp || typeof resp !== "object") return null;
  const r = resp as Record<string, unknown>;
  if (typeof r.response === "string" && r.response.trim()) return r.response.trim();
  if (Array.isArray(r.choices)) {
    const first = r.choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
    const fromMsg = first?.message?.content;
    if (typeof fromMsg === "string" && fromMsg.trim()) return fromMsg.trim();
    if (typeof first?.text === "string" && first.text.trim()) return first.text.trim();
  }
  if (typeof r.content === "string" && r.content.trim()) return r.content.trim();
  if (r.response && typeof r.response === "object") {
    const inner = r.response as Record<string, unknown>;
    if (typeof inner.content === "string" && inner.content.trim()) return inner.content.trim();
  }
  return null;
}
