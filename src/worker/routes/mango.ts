import { Hono } from "hono";
import { verify } from "hono/jwt";
import type { AuthVariables } from "../lib/auth";

const mango = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

export interface MangoRole {
  id: string;
  company: "Meta" | "Apple" | "Netflix" | "Google" | "OpenAI" | "Cloudflare" | "Stripe" | "Anthropic" | "Amazon";
  companyInitial: string;
  companyColor: string;
  title: string;
  category: "AI / ML & Foundation Models" | "Distributed Systems & Cloud" | "Security & Core Systems" | "Full-Stack & Platforms";
  level: "Senior" | "Staff" | "Principal";
  location: string;
  workMode: "Remote" | "Hybrid" | "In-Office";
  salary: string;
  trendingBadge: string;
  description: string;
  requirements: string[];
  skills: string[];
  officialUrl: string;
  companyHiringBarTip: string;
}

export const CURATED_MANGO_ROLES: MangoRole[] = [
  {
    id: "openai-rl-researcher",
    company: "OpenAI",
    companyInitial: "O",
    companyColor: "#10a37f",
    title: "Research Engineer - Post-Training & Reinforcement Learning",
    category: "AI / ML & Foundation Models",
    level: "Senior",
    location: "San Francisco, CA",
    workMode: "In-Office",
    salary: "$320,000 – $450,000 + Equity",
    trendingBadge: "🔥 #1 Trending AI Role",
    description: "Build cutting-edge reinforcement learning from human feedback (RLHF), reasoning algorithms, and scaling post-training infrastructure for next-generation frontier reasoning models.",
    requirements: [
      "Demonstrated experience with large-scale deep learning training, RL, or model alignment",
      "Proficiency in PyTorch, Triton, CUDA, or distributed training topologies (FSDP, Megatron)",
      "Strong intuition for empirical ML experimentation and error analysis on generative output",
      "Publication or track record of shipping production foundation model improvements",
    ],
    skills: ["PyTorch", "Reinforcement Learning", "Distributed Training", "CUDA", "Triton", "Python"],
    officialUrl: "https://openai.com/careers",
    companyHiringBarTip: "OpenAI emphasizes deep empirical ML instincts, live debugging of training dynamics, and rapid coding velocity on novel algorithmic implementations.",
  },
  {
    id: "meta-ai-prod-infra",
    company: "Meta",
    companyInitial: "M",
    companyColor: "#0668e1",
    title: "Production Engineer - Distributed AI Clusters & RoCE Networking",
    category: "Distributed Systems & Cloud",
    level: "Staff",
    location: "Menlo Park, CA / Remote",
    workMode: "Hybrid",
    salary: "$230,000 – $350,000 + Equity",
    trendingBadge: "⚡ High Demand Infrastructure",
    description: "Architect and automate 100k+ GPU training clusters powering Llama foundation models. Optimize RoCEv2 network fabrics, kernel bypass protocols, and failure recovery at planetary scale.",
    requirements: [
      "Deep expertise in Linux kernel internals, TCP/IP, RoCEv2, and high-performance interconnects (NCCL)",
      "Strong systems programming in C++, Python, or Rust for fleet-wide automation",
      "Proven background debugging silent data corruption and GPU cluster hardware unreliability",
      "Track record maintaining mission-critical infra with strict 99.99% availability SLAs",
    ],
    skills: ["Linux Kernel", "RoCEv2 / RDMA", "NCCL", "C++", "Python", "GPU Clusters", "Distributed Systems"],
    officialUrl: "https://www.metacareers.com",
    companyHiringBarTip: "Meta's Systems Design & Triage interviews test live troubleshooting of Linux kernel network bottlenecks and massive-scale cluster failure domains.",
  },
  {
    id: "google-deepmind-gemini-agents",
    company: "Google",
    companyInitial: "G",
    companyColor: "#4285f4",
    title: "Staff Software Engineer - Multimodal Gemini Autonomous Agents",
    category: "AI / ML & Foundation Models",
    level: "Staff",
    location: "Mountain View, CA / London, UK",
    workMode: "Hybrid",
    salary: "$280,000 – $410,000 + GSU Equity",
    trendingBadge: "🔥 Top Trending Tech",
    description: "Lead the architecture and production deployment of interactive Gemini autonomous agents capable of tool orchestration, multimodal perception, and multi-step reasoning.",
    requirements: [
      "Extensive experience building production LLM orchestration, agentic tool-use loops, and eval suites",
      "Expertise in distributed serving systems (JAX, TensorFlow, or vLLM/TensorRT-LLM)",
      "Experience leading technical direction across cross-functional research and engineering teams",
      "BS/MS/PhD in Computer Science or equivalent practical industry experience",
    ],
    skills: ["JAX", "Python", "Autonomous Agents", "LLM Tool-Calling", "Distributed Serving", "C++"],
    officialUrl: "https://careers.google.com",
    companyHiringBarTip: "Google assesses 'Googleyness' along with algorithmic rigor and scalable system design that can handle billions of daily user queries.",
  },
  {
    id: "apple-coreos-neural",
    company: "Apple",
    companyInitial: "A",
    companyColor: "#1d1d1f",
    title: "Senior CoreOS Systems Engineer - Apple Silicon Neural Engine (ANE)",
    category: "Security & Core Systems",
    level: "Senior",
    location: "Cupertino, CA",
    workMode: "In-Office",
    salary: "$225,000 – $330,000 + RSU",
    trendingBadge: "⚡ Edge Silicon Pioneer",
    description: "Write low-level drivers, kernel extensions, and runtime compilers that bridge Apple Intelligence foundation models with custom Apple Silicon Neural Engine hardware.",
    requirements: [
      "Mastery of modern C, C++, and low-level assembly for ARM/Apple Silicon architectures",
      "In-depth knowledge of OS kernel scheduling, memory management, and hardware DMA controllers",
      "Experience optimizing neural network graph execution, quantization, and tensor core compilers",
      "Passion for battery efficiency, low-latency edge inference, and on-device privacy",
    ],
    skills: ["C/C++", "ARM Architecture", "Kernel Drivers", "Neural Engine Compiler", "Memory Subsystems"],
    officialUrl: "https://www.apple.com/careers",
    companyHiringBarTip: "Apple evaluates deep hardware-software boundary intuition: expect questions on cache coherency, memory bus contention, and nanosecond latency trade-offs.",
  },
  {
    id: "netflix-streaming-edge",
    company: "Netflix",
    companyInitial: "N",
    companyColor: "#e50914",
    title: "Principal Streaming Edge & Playback Systems Architect",
    category: "Distributed Systems & Cloud",
    level: "Principal",
    location: "Los Gatos, CA",
    workMode: "Hybrid",
    salary: "$450,000 – $650,000 (All-Cash Flexibility)",
    trendingBadge: "🏆 Top Tier Compensation",
    description: "Own the end-to-end architecture delivering 4K HDR live and VOD streams to 280+ million global subscribers with sub-second buffering and dynamic edge routing.",
    requirements: [
      "10+ years architecting globally distributed CDN, edge proxy, and traffic steering architectures",
      "Deep understanding of HTTP/3, QUIC, adaptive bitrate streaming (HLS, DASH), and BGP anycast",
      "Proficiency in Go, Java, or Rust with deep knowledge of AWS or Open Connect appliance design",
      "Ability to exercise high context and stunning judgment with radical autonomy",
    ],
    skills: ["QUIC / HTTP3", "Edge Routing", "Go", "Rust", "Adaptive Bitrate", "AWS / CDN"],
    officialUrl: "https://jobs.netflix.com",
    companyHiringBarTip: "Netflix has no junior roles and maintains a famous culture of 'Freedom & Responsibility'. Be ready to defend technical trade-offs with commercial acumen.",
  },
  {
    id: "cloudflare-workers-wasm",
    company: "Cloudflare",
    companyInitial: "C",
    companyColor: "#f38020",
    title: "Staff Distributed Systems Engineer - Workers & Wasm Runtime",
    category: "Distributed Systems & Cloud",
    level: "Staff",
    location: "San Francisco, CA / Austin, TX / Remote",
    workMode: "Remote",
    salary: "$210,000 – $315,000 + Equity",
    trendingBadge: "🔥 Next-Gen Cloud Platform",
    description: "Build the next generation of serverless compute powered by V8 isolates and WebAssembly running across Cloudflare's 330+ city global anycast edge network.",
    requirements: [
      "Strong systems programming background in C++, Rust, or modern Go",
      "Experience with V8 isolate runtime internals, WebAssembly execution, or POSIX virtualization",
      "Deep grasp of distributed consensus, zero-trust sandboxing, and sub-millisecond cold starts",
      "Comfort working in a collaborative, fast-paced edge cloud infrastructure engineering team",
    ],
    skills: ["Rust", "C++", "V8 Isolates", "WebAssembly", "Distributed Systems", "Cloudflare Workers"],
    officialUrl: "https://www.cloudflare.com/careers",
    companyHiringBarTip: "Cloudflare champions candidate curiosity and edge-first thinking. Expect hands-on systems architecture problems exploring latency and cold starts.",
  },
  {
    id: "stripe-ledger-infra",
    company: "Stripe",
    companyInitial: "S",
    companyColor: "#635bff",
    title: "Staff Infrastructure Engineer - Global Money Ledger",
    category: "Distributed Systems & Cloud",
    level: "Staff",
    location: "Seattle, WA / San Francisco, CA / Remote",
    workMode: "Remote",
    salary: "$260,000 – $380,000 + Equity",
    trendingBadge: "⚡ High-Scale FinTech",
    description: "Design immutable, distributed double-entry ledger engines that process hundreds of billions of dollars annually with zero loss, deterministic replay, and multi-region failover.",
    requirements: [
      "Extensive experience building mission-critical transactional storage engines or distributed databases",
      "Mastery of concurrency control (MVCC, Raft, Paxos), formal verification, and distributed transactions",
      "Proficiency in Ruby, Java, Go, or TypeScript with strong API design taste",
      "Strong commitment to correctness, reliability, and automated invariant verification",
    ],
    skills: ["Distributed DBs", "Raft / Paxos", "High-Throughput Systems", "Ruby / Go", "ACID Transactions"],
    officialUrl: "https://stripe.com/jobs",
    companyHiringBarTip: "Stripe looks for exceptional written communication, clean API design abstractions, and a relentless focus on zero-downtime database migrations.",
  },
  {
    id: "anthropic-safety-alignment",
    company: "Anthropic",
    companyInitial: "A",
    companyColor: "#cc785c",
    title: "Safety Systems & Scalable Oversight Engineer",
    category: "AI / ML & Foundation Models",
    level: "Senior",
    location: "San Francisco, CA",
    workMode: "In-Office",
    salary: "$300,000 – $430,000 + Equity",
    trendingBadge: "🔥 Frontier AI Alignment",
    description: "Develop automated red-teaming harnesses, interpretability probes, and constitutional AI alignment pipelines to ensure Claude models remain helpful, honest, and harmless.",
    requirements: [
      "Strong software engineering and machine learning background with Python and PyTorch",
      "Demonstrated interest or experience in AI safety, mechanistic interpretability, or adversarial evaluation",
      "Experience deploying high-throughput evaluation harnesses on clusters of thousands of nodes",
      "Intellectual curiosity and ability to work thoughtfully in a high-stakes AI safety laboratory",
    ],
    skills: ["Python", "PyTorch", "AI Safety", "Constitutional AI", "Adversarial Testing", "Evaluations"],
    officialUrl: "https://www.anthropic.com/careers",
    companyHiringBarTip: "Anthropic prizes rigor, humility, and mission alignment. Interviews focus on both empirical coding and deep thought on model behaviors and failure modes.",
  },
  {
    id: "amazon-bedrock-solutions-arch",
    company: "Amazon",
    companyInitial: "A",
    companyColor: "#ff9900",
    title: "Principal Solutions Architect - AWS Bedrock & Enterprise GenAI",
    category: "Full-Stack & Platforms",
    level: "Principal",
    location: "Seattle, WA / Remote",
    workMode: "Hybrid",
    salary: "$220,000 – $315,000 + RSU",
    trendingBadge: "⚡ Enterprise Cloud Scale",
    description: "Partner with Global Fortune 50 CTOs to architect enterprise-grade Generative AI applications, fine-tuning workflows, and secure RAG data architectures on AWS Bedrock.",
    requirements: [
      "10+ years architecting enterprise cloud solutions with AWS compute, storage, and networking services",
      "Hands-on expertise with vector databases (OpenSearch, Pinecone), retrieval-augmented generation (RAG)",
      "Strong executive communication skills and ability to influence technical roadmaps",
      "Deep alignment with Amazon Leadership Principles (Customer Obsession, Invent and Simplify)",
    ],
    skills: ["AWS Bedrock", "RAG Architecture", "Vector Databases", "Enterprise Security", "Python"],
    officialUrl: "https://www.amazon.jobs",
    companyHiringBarTip: "Amazon places equal weight on technical depth and Amazon Leadership Principles. Structure behavioral answers strictly using the STAR format.",
  },
];

// Helper to extract JSON record from AI output
function extractJson(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  const resp = (typeof raw === "object") ? (raw as Record<string, unknown>) : { response: String(raw) };
  if (resp.response && typeof resp.response === "object") {
    return resp.response as Record<string, unknown>;
  }
  let text = "";
  if (typeof resp.response === "string") text = resp.response;
  else if (typeof resp.content === "string") text = resp.content;
  else text = JSON.stringify(resp);

  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── GET /api/mango/roles ───────────────────────────────────────────────────────
mango.get("/roles", (c) => {
  const companyQuery = c.req.query("company");
  const categoryQuery = c.req.query("category");
  const search = c.req.query("q")?.toLowerCase();

  let roles = [...CURATED_MANGO_ROLES];

  if (companyQuery && companyQuery !== "all") {
    roles = roles.filter((r) => r.company.toLowerCase() === companyQuery.toLowerCase());
  }

  if (categoryQuery && categoryQuery !== "all") {
    roles = roles.filter((r) => r.category.toLowerCase().includes(categoryQuery.toLowerCase()));
  }

  if (search) {
    roles = roles.filter(
      (r) =>
        r.title.toLowerCase().includes(search) ||
        r.company.toLowerCase().includes(search) ||
        r.skills.some((s) => s.toLowerCase().includes(search)) ||
        r.description.toLowerCase().includes(search)
    );
  }

  return c.json({
    total: roles.length,
    roles,
  });
});

// ── GET /api/mango/roles/:id ───────────────────────────────────────────────────
mango.get("/roles/:id", (c) => {
  const role = CURATED_MANGO_ROLES.find((r) => r.id === c.req.param("id"));
  if (!role) {
    return c.json({ error: "Role not found" }, 404);
  }
  return c.json(role);
});

// ── POST /api/mango/simulate-match ─────────────────────────────────────────────
// Runs an instant AI match evaluation of a candidate's resume against a MANGO role
mango.post("/simulate-match", async (c) => {
  let body: { roleId: string; cvText?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON request" }, 400);
  }

  const role = CURATED_MANGO_ROLES.find((r) => r.id === body.roleId);
  if (!role) {
    return c.json({ error: "Target MANGO role not found" }, 404);
  }

  let resumeText = body.cvText?.trim() || "";

  // If no resume provided, inspect Authorization header for candidate token
  if (!resumeText) {
    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ") && c.env.JWT_SECRET) {
      try {
        const token = authHeader.slice(7);
        const payload = await verify(token, c.env.JWT_SECRET, "HS256");
        if (payload.userId && payload.role === "candidate") {
          const userId = String(payload.userId);
          // 1. Check latest application resume
          const latestApp = await c.env.DB.prepare(`
            SELECT cand.resume_text
            FROM applications a
            JOIN candidates cand ON cand.id = a.candidate_submission_id
            WHERE a.user_id = ?
            ORDER BY a.applied_at DESC
            LIMIT 1
          `).bind(userId).first<{ resume_text: string }>();

          if (latestApp?.resume_text) {
            resumeText = latestApp.resume_text;
          } else {
            // 2. Check candidate profile
            const prof = await c.env.DB.prepare(`
              SELECT headline, bio, skills, years_of_experience FROM candidate_profiles WHERE user_id = ?
            `).bind(userId).first<{ headline?: string; bio?: string; skills?: string; years_of_experience?: number }>();
            if (prof?.skills || prof?.headline || prof?.bio) {
              resumeText = `Candidate Headline: ${prof.headline || ""}\nExperience: ${prof.years_of_experience || ""} years\nSkills: ${prof.skills || ""}\nBio: ${prof.bio || ""}`;
            }
          }
        }
      } catch {
        // Silent token decode failure, fall through
      }
    }
  }

  if (!resumeText || resumeText.length < 20) {
    return c.json(
      {
        error: "No resume provided or found. Please paste your CV text to simulate your match fit.",
        needsInput: true,
      },
      400
    );
  }

  // Pre-calculate deterministic skill match baseline to guide and ground the evaluation
  const lowerResume = resumeText.toLowerCase();
  const matchedSkillsDetected = role.skills.filter((skill) => lowerResume.includes(skill.toLowerCase()));
  const missingSkillsDetected = role.skills.filter((skill) => !lowerResume.includes(skill.toLowerCase()));
  const skillRatio = matchedSkillsDetected.length / Math.max(1, role.skills.length);

  // Evaluate candidate fit against the MANGO role using Workers AI
  const prompt = `You are an elite Senior Bar Raiser and Staff Engineering Hiring Committee member at ${role.company}.
Evaluate this candidate's Resume against our target role:
TARGET COMPANY: ${role.company}
ROLE: ${role.title} (${role.level} Level)
LOCATION: ${role.location} (${role.workMode})
SALARY BENCHMARK: ${role.salary}
CORE TECH STACK: ${role.skills.join(", ")}
ROLE REQUIREMENTS:
${role.requirements.map((r) => `- ${r}`).join("\n")}
INSIDER HIRING BAR: ${role.companyHiringBarTip}

CANDIDATE RESUME:
${resumeText.slice(0, 4500)}

INSTRUCTIONS FOR SCORING:
- Calculate an honest, non-inflated "matchScore" between 10 and 98 based strictly on how well this resume matches the requirements and tech stack of ${role.company}.
- 15 to 45: Low alignment. The candidate is missing almost all required technologies (e.g. general web developer applying for CUDA RL or kernel drivers).
- 46 to 68: Partial fit. Possesses general software engineering fundamentals, but lacks direct production depth in the core technologies.
- 69 to 84: Competitive fit. Strong relevant skills with some addressable gaps.
- 85 to 98: Exceptional direct fit for ${role.company}'s highest technical standards.
- CRITICAL: Calculate the score accurately based on the candidate's actual qualifications. Do NOT output 82 or any arbitrary number unless justified.

Return ONLY a single valid raw JSON object with NO markdown fences, NO backticks:
{
  "matchScore": <integer between 10 and 98 based on real fit>,
  "verdict": "<Honest verdict, e.g. 'Low Alignment for ${role.company}', 'Moderate Match with Gaps', 'Competitive Match', or 'Exceptional Contender'>",
  "confidence": "High",
  "matchedSkills": ["<skills from the resume that match this role>"],
  "missingKeywords": ["<critical required technologies or concepts absent from resume>"],
  "strengths": ["<specific resume strength 1 relevant to ${role.company}>", "<strength 2>"],
  "resumeGaps": ["<specific gap or improvement needed before applying>", "<gap 2>"],
  "insiderInterviewAdvice": "<insider advice for passing ${role.company}'s specific interview loop>"
}`;

  try {
    const aiResponse = await c.env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast" as Parameters<typeof c.env.AI.run>[0],
      {
        messages: [
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
      }
    );

    const parsed = extractJson(aiResponse);

    if (!parsed) {
      // Dynamic fallback heuristic score based on actual skills overlap
      const heuristicScore = Math.max(22, Math.min(94, Math.round(28 + skillRatio * 58 + Math.min(10, resumeText.length / 400))));
      const verdict = heuristicScore >= 78 ? `Competitive Match for ${role.company}` : heuristicScore >= 55 ? `Moderate Match with Gaps` : `Low Alignment for ${role.company}`;

      return c.json({
        success: true,
        roleId: role.id,
        roleTitle: role.title,
        company: role.company,
        matchScore: heuristicScore,
        verdict,
        confidence: "Medium",
        matchedSkills: matchedSkillsDetected.length > 0 ? matchedSkillsDetected : role.skills.slice(0, 1),
        missingKeywords: missingSkillsDetected.length > 0 ? missingSkillsDetected : role.skills.slice(2, 4),
        strengths: [
          matchedSkillsDetected.length > 0
            ? `Demonstrated familiarity with ${matchedSkillsDetected.slice(0, 2).join(" and ")}`
            : `Engineering background with transferable problem-solving capabilities`,
          "Relevant professional software engineering trajectory",
        ],
        resumeGaps: [
          missingSkillsDetected.length > 0
            ? `Missing explicit production experience with ${missingSkillsDetected.slice(0, 2).join(", ")}`
            : `Highlight quantitative scale and latency benchmarks for ${role.skills[0]} on your CV`,
        ],
        insiderInterviewAdvice: role.companyHiringBarTip,
      });
    }

    let parsedScore = Number(parsed.matchScore);
    if (isNaN(parsedScore) || parsedScore <= 0 || parsedScore > 100) {
      parsedScore = Math.round(28 + skillRatio * 58);
    }

    // Sanity check: If zero required skills matched, cap score at 54 max
    if (matchedSkillsDetected.length === 0 && parsedScore > 54) {
      parsedScore = Math.min(52, Math.max(22, Math.round(parsedScore * 0.6)));
    }

    const finalScore = Math.max(12, Math.min(98, Math.round(parsedScore)));

    return c.json({
      success: true,
      roleId: role.id,
      roleTitle: role.title,
      company: role.company,
      matchScore: finalScore,
      verdict: String(parsed.verdict || (finalScore >= 75 ? `Competitive Contender for ${role.company}` : `Moderate Match`)),
      confidence: String(parsed.confidence || "High"),
      matchedSkills: Array.isArray(parsed.matchedSkills) && parsed.matchedSkills.length > 0
        ? parsed.matchedSkills
        : (matchedSkillsDetected.length > 0 ? matchedSkillsDetected : ["Foundational Engineering"]),
      missingKeywords: Array.isArray(parsed.missingKeywords) && parsed.missingKeywords.length > 0
        ? parsed.missingKeywords
        : (missingSkillsDetected.length > 0 ? missingSkillsDetected : role.skills.slice(2, 4)),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      resumeGaps: Array.isArray(parsed.resumeGaps) ? parsed.resumeGaps : [],
      insiderInterviewAdvice: String(parsed.insiderInterviewAdvice || role.companyHiringBarTip),
    });
  } catch (err) {
    console.error("[mango] AI evaluation error:", String(err));
    const fallbackScore = Math.max(20, Math.min(92, Math.round(28 + skillRatio * 58)));
    return c.json({
      success: true,
      roleId: role.id,
      roleTitle: role.title,
      company: role.company,
      matchScore: fallbackScore,
      verdict: fallbackScore >= 75 ? `Competitive Contender for ${role.company}` : `Moderate Match with Gaps`,
      confidence: "Medium",
      matchedSkills: matchedSkillsDetected.length > 0 ? matchedSkillsDetected : role.skills.slice(0, 1),
      missingKeywords: missingSkillsDetected.length > 0 ? missingSkillsDetected : role.skills.slice(2, 4),
      strengths: [
        `Demonstrated background relevant to modern engineering architectures`,
      ],
      resumeGaps: [
        `Explicitly highlight metrics and throughput benchmarks for ${role.skills[0]} on your resume`,
      ],
      insiderInterviewAdvice: role.companyHiringBarTip,
    });
  }
});

export default mango;
