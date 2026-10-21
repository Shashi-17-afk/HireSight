export const CV_ANALYSIS_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export interface RecommendedQuestion {
  topic: string;
  question: string;
  targetSignal: string;
}

export interface CvAnalysisResult {
  matchScore: number;
  verdict: "Strong Fit" | "Good Match" | "Moderate Fit" | "Low Alignment";
  summary: string;
  seniority: {
    estimatedYears: number;
    level: "Entry-Level" | "Mid-Level" | "Senior" | "Lead / Staff" | "Executive";
    alignmentWithRole: "Aligned" | "Overqualified" | "Under-experienced";
  };
  skillsAnalysis: {
    matchedSkills: string[];
    missingSkills: string[];
    bonusSkills: string[];
  };
  strengths: string[];
  concernsOrGaps: string[];
  recommendedInterviewQuestions: RecommendedQuestion[];
  atsScores: {
    technicalFit: number;
    experienceRelevance: number;
    educationAndDomain: number;
    impactAndClarity: number;
  };
}

function buildCvAnalysisPrompt(jobTitle: string, jobDescription: string, resumeText: string): string {
  const truncatedResume = resumeText.slice(0, 4500);
  const truncatedJd = jobDescription.slice(0, 2000);

  return `You are an expert executive talent screener and ATS evaluation AI.
Analyze the candidate's Resume against the target Job Specification.

TARGET JOB TITLE: ${jobTitle}
TARGET JOB DESCRIPTION:
${truncatedJd}

CANDIDATE RESUME TEXT:
${truncatedResume}

Provide an in-depth, rigorous evaluation. Return ONLY a single raw valid JSON object with no markdown fences, no backticks, and no explanation text before or after:
{
  "matchScore": 85,
  "verdict": "Strong Fit",
  "summary": "Concise 2-3 sentence executive summary of candidate background and alignment.",
  "seniority": {
    "estimatedYears": 5,
    "level": "Senior",
    "alignmentWithRole": "Aligned"
  },
  "skillsAnalysis": {
    "matchedSkills": ["TypeScript", "React", "Cloudflare Workers"],
    "missingSkills": ["GraphQL"],
    "bonusSkills": ["Docker", "Kubernetes"]
  },
  "strengths": [
    "Strong full-stack architecture background",
    "Proven experience delivering scalable web applications"
  ],
  "concernsOrGaps": [
    "Limited explicit enterprise production experience with GraphQL"
  ],
  "recommendedInterviewQuestions": [
    {
      "topic": "Distributed State & Caching",
      "question": "Can you walk through how you manage high-throughput session state in edge environments?",
      "targetSignal": "Assess deep understanding of latency, eventual consistency, and cache invalidation."
    }
  ],
  "atsScores": {
    "technicalFit": 88,
    "experienceRelevance": 85,
    "educationAndDomain": 80,
    "impactAndClarity": 90
  }
}`;
}

function cleanAndParseJson<T>(raw: unknown): T | null {
  const resp = raw as Record<string, unknown>;

  if (resp.response && typeof resp.response === "object") {
    return resp.response as T;
  }

  let text = "";
  if (typeof resp.response === "string") text = resp.response;
  else if (typeof resp.content === "string") text = resp.content;
  else text = JSON.stringify(resp);

  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

/**
 * Executes in-depth AI CV Analysis using Workers AI.
 */
export async function analyzeCandidateCv(
  ai: Ai,
  jobTitle: string,
  jobDescription: string,
  resumeText: string
): Promise<CvAnalysisResult | null> {
  try {
    const response = await ai.run(CV_ANALYSIS_MODEL as Parameters<Ai["run"]>[0], {
      messages: [
        {
          role: "user",
          content: buildCvAnalysisPrompt(jobTitle, jobDescription, resumeText),
        },
      ],
      max_tokens: 1024,
    });

    const parsed = cleanAndParseJson<CvAnalysisResult>(response);
    if (!parsed || typeof parsed.matchScore !== "number") {
      return null;
    }

    // Sanitize and guarantee defaults
    return {
      matchScore: Math.min(100, Math.max(0, Math.round(parsed.matchScore))),
      verdict: parsed.verdict || (parsed.matchScore >= 80 ? "Strong Fit" : parsed.matchScore >= 60 ? "Good Match" : "Moderate Fit"),
      summary: parsed.summary || "Candidate assessment completed.",
      seniority: {
        estimatedYears: parsed.seniority?.estimatedYears ?? 3,
        level: parsed.seniority?.level || "Mid-Level",
        alignmentWithRole: parsed.seniority?.alignmentWithRole || "Aligned",
      },
      skillsAnalysis: {
        matchedSkills: Array.isArray(parsed.skillsAnalysis?.matchedSkills) ? parsed.skillsAnalysis.matchedSkills : [],
        missingSkills: Array.isArray(parsed.skillsAnalysis?.missingSkills) ? parsed.skillsAnalysis.missingSkills : [],
        bonusSkills: Array.isArray(parsed.skillsAnalysis?.bonusSkills) ? parsed.skillsAnalysis.bonusSkills : [],
      },
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ["Demonstrates core competencies aligned with job description."],
      concernsOrGaps: Array.isArray(parsed.concernsOrGaps) ? parsed.concernsOrGaps : [],
      recommendedInterviewQuestions: Array.isArray(parsed.recommendedInterviewQuestions)
        ? parsed.recommendedInterviewQuestions
        : [],
      atsScores: {
        technicalFit: parsed.atsScores?.technicalFit ?? parsed.matchScore,
        experienceRelevance: parsed.atsScores?.experienceRelevance ?? parsed.matchScore,
        educationAndDomain: parsed.atsScores?.educationAndDomain ?? 80,
        impactAndClarity: parsed.atsScores?.impactAndClarity ?? 85,
      },
    };
  } catch (err) {
    console.error("[analyzeCandidateCv] AI inference error:", err);
    return null;
  }
}

export interface CandidateCvAudit {
  atsScore: number;
  verdict: string;
  levelDetected: string;
  summary: string;
  detectedSkills: string[];
  missingKeywords: string[];
  metrics: {
    actionVerbStrength: number;
    quantificationScore: number;
    atsReadability: number;
    keywordMatchRate: number;
  };
  strengths: string[];
  keyImprovements: string[];
  interviewPrepTips: string[];
}

function buildCandidateAuditPrompt(resumeText: string, targetRole?: string, targetJd?: string): string {
  const truncatedResume = resumeText.slice(0, 4500);
  const roleContext = targetRole ? `TARGET ROLE: ${targetRole}` : "TARGET ROLE: General Tech / Software Industry";
  const jdContext = targetJd ? `TARGET JD EXCERPT:\n${targetJd.slice(0, 1500)}` : "";

  return `You are an elite career coach, resume optimizer, and ATS scanning engine.
Evaluate this candidate's resume and provide actionable optimization advice to maximize their interview callback rates.

${roleContext}
${jdContext}

RESUME CONTENT:
${truncatedResume}

Provide an honest, high-impact assessment. Return ONLY a single raw valid JSON object with no markdown fences, no backticks, and no explanation text before or after:
{
  "atsScore": 82,
  "verdict": "Competitive Profile",
  "levelDetected": "Senior Full-Stack Engineer (5+ YOE)",
  "summary": "Strong engineering foundation with demonstrated production experience, but could quantify business outcomes further.",
  "detectedSkills": ["TypeScript", "React", "Node.js", "PostgreSQL", "System Design"],
  "missingKeywords": ["CI/CD Pipelines", "Docker", "Unit Testing", "Cloud Architecture"],
  "metrics": {
    "actionVerbStrength": 85,
    "quantificationScore": 70,
    "atsReadability": 90,
    "keywordMatchRate": 82
  },
  "strengths": [
    "Clear chronology and relevant technical stack",
    "Solid technical depth in full-stack web technologies"
  ],
  "keyImprovements": [
    "Quantify project achievements with metrics (e.g. reduced latency by 35% or supported 100k users)",
    "Include specific cloud architecture and deployment pipeline keywords"
  ],
  "interviewPrepTips": [
    "Prepare architecture deep-dives on your distributed data storage decisions",
    "Be ready to explain how you handle performance bottlenecks under load"
  ]
}`;
}

/**
 * Audits a candidate's CV from a job-seeker ATS optimization perspective.
 */
export async function auditResumeForCandidate(
  ai: Ai,
  resumeText: string,
  targetRole?: string,
  targetJd?: string
): Promise<CandidateCvAudit | null> {
  try {
    const response = await ai.run(CV_ANALYSIS_MODEL as Parameters<Ai["run"]>[0], {
      messages: [
        {
          role: "user",
          content: buildCandidateAuditPrompt(resumeText, targetRole, targetJd),
        },
      ],
      max_tokens: 1024,
    });

    const parsed = cleanAndParseJson<CandidateCvAudit>(response);
    if (!parsed || typeof parsed.atsScore !== "number") {
      return null;
    }

    return {
      atsScore: Math.min(100, Math.max(0, Math.round(parsed.atsScore))),
      verdict: parsed.verdict || "Standard Profile",
      levelDetected: parsed.levelDetected || "Mid-Level Professional",
      summary: parsed.summary || "Resume audit completed.",
      detectedSkills: Array.isArray(parsed.detectedSkills) ? parsed.detectedSkills : [],
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
      metrics: {
        actionVerbStrength: parsed.metrics?.actionVerbStrength ?? parsed.atsScore,
        quantificationScore: parsed.metrics?.quantificationScore ?? 75,
        atsReadability: parsed.metrics?.atsReadability ?? 85,
        keywordMatchRate: parsed.metrics?.keywordMatchRate ?? parsed.atsScore,
      },
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ["Clear technical background"],
      keyImprovements: Array.isArray(parsed.keyImprovements) ? parsed.keyImprovements : ["Add more metrics and outcome numbers to bullet points."],
      interviewPrepTips: Array.isArray(parsed.interviewPrepTips) ? parsed.interviewPrepTips : ["Prepare concrete examples of technical challenges solved."],
    };
  } catch (err) {
    console.error("[auditResumeForCandidate] inference error:", err);
    return null;
  }
}

