export const SCORING_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export interface LlmScore {
  score: number;
  reasoning: string;
}

function buildScoringPrompt(jobDescription: string, resumeText: string): string {
  return `You are a hiring assistant. Given this Job Description and Resume, score the candidate from 0-100 and give 2 line reasoning.
Return ONLY valid JSON with no extra text: { "score": number, "reasoning": string }

JD: ${jobDescription}
Resume: ${resumeText}`;
}

function parseScoreResponse(raw: unknown): { score?: unknown; reasoning?: unknown } | null {
  const resp = raw as Record<string, unknown>;

  // The -fast model may return { response: { score, reasoning } }; older models return { response: "string" }.
  if (resp.response && typeof resp.response === "object") {
    return resp.response as { score?: unknown; reasoning?: unknown };
  }

  let rawText = "";
  if (typeof resp.response === "string") rawText = resp.response;
  else if (typeof resp.content === "string") rawText = resp.content;
  else rawText = JSON.stringify(resp);

  const cleaned = rawText.replace(/```(?:json)?/gi, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as { score?: unknown; reasoning?: unknown };
  } catch {
    return null;
  }
}

/**
 * Scores a resume against a job description with Workers AI.
 * Throws if the model call fails; returns null if the reply has no usable score.
 */
export async function scoreResumeWithLlm(
  ai: Ai,
  jobDescription: string,
  resumeText: string
): Promise<LlmScore | null> {
  const llmResponse = await ai.run(SCORING_MODEL as Parameters<Ai["run"]>[0], {
    messages: [{ role: "user", content: buildScoringPrompt(jobDescription, resumeText) }],
    max_tokens: 256,
  });

  const parsed = parseScoreResponse(llmResponse);
  if (!parsed || typeof parsed.score !== "number" || parsed.score < 0 || parsed.score > 100) {
    return null;
  }

  const reasoning =
    typeof parsed.reasoning === "string" && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : "No reasoning returned by the model.";

  return { score: Math.round(parsed.score), reasoning };
}
