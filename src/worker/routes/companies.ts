import { Hono } from "hono";
import type { AuthVariables } from "../lib/auth";

const companies = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  industry: string;
  location: string;
  size: string;
  website: string;
  founded: number;
  tags: string[];
  color: string;
  initial: string;
  openRolesCount: number;
}

const CURATED_COMPANIES: Omit<CompanyProfile, "openRolesCount">[] = [
  {
    id: "comp-hiresight",
    name: "HireSight Technologies",
    slug: "hiresight",
    tagline: "Next-generation edge AI hiring intelligence & screening engine",
    description: "HireSight builds serverless AI screening, semantic resume evaluation, and real-time talent pipelines on Cloudflare Workers and Workers AI.",
    industry: "AI & HR Tech",
    location: "San Francisco, CA · Remote",
    size: "50-200 employees",
    website: "https://hiresight.app",
    founded: 2024,
    tags: ["Cloudflare Workers", "TypeScript", "React", "AI/ML", "Vectorize"],
    color: "#0d0d0d",
    initial: "H",
  },
  {
    id: "comp-cloudflare",
    name: "Cloudflare",
    slug: "cloudflare",
    tagline: "Building a better and faster internet for everyone",
    description: "Cloudflare protects and accelerates any internet application online without adding hardware, installing software, or changing a line of code.",
    industry: "Cloud & Infrastructure",
    location: "San Francisco, CA · Hybrid",
    size: "1,000-5,000 employees",
    website: "https://cloudflare.com",
    founded: 2009,
    tags: ["Rust", "Go", "Distributed Systems", "Networking", "Wasm"],
    color: "#f38020",
    initial: "C",
  },
  {
    id: "comp-stripe",
    name: "Stripe",
    slug: "stripe",
    tagline: "Financial infrastructure for the internet",
    description: "Stripe is a technology company that builds economic infrastructure for the internet. Millions of businesses of every size use our software to accept payments.",
    industry: "Fintech",
    location: "San Francisco, CA · Remote-First",
    size: "5,000+ employees",
    website: "https://stripe.com",
    founded: 2010,
    tags: ["Ruby", "TypeScript", "Distributed DBs", "Financial APIs", "React"],
    color: "#635bff",
    initial: "S",
  },
  {
    id: "comp-vercel",
    name: "Vercel",
    slug: "vercel",
    tagline: "The frontend cloud for modern digital experiences",
    description: "Vercel enables teams to develop, preview, and ship high-performance web applications with Next.js and serverless infrastructure.",
    industry: "Developer Tools",
    location: "Remote Worldwide",
    size: "500-1,000 employees",
    website: "https://vercel.com",
    founded: 2015,
    tags: ["Next.js", "React", "Serverless", "Node.js", "Edge Computing"],
    color: "#000000",
    initial: "V",
  },
  {
    id: "comp-linear",
    name: "Linear",
    slug: "linear",
    tagline: "The issue tracker designed for high-performance product teams",
    description: "Linear helps streamline software projects, sprints, tasks, and bug tracking. Built with synchronization, speed, and keyboard-first design in mind.",
    industry: "Productivity & SaaS",
    location: "San Francisco, CA · Remote",
    size: "50-150 employees",
    website: "https://linear.app",
    founded: 2019,
    tags: ["TypeScript", "GraphQL", "Sync Engines", "Design Systems"],
    color: "#5e6ad2",
    initial: "L",
  },
  {
    id: "comp-supabase",
    name: "Supabase",
    slug: "supabase",
    tagline: "The open source Firebase alternative",
    description: "Supabase provides all the backend services you need to build a product: Postgres database, Authentication, instant APIs, Edge Functions, and Storage.",
    industry: "Developer Platforms",
    location: "Singapore · Remote",
    size: "100-250 employees",
    website: "https://supabase.com",
    founded: 2020,
    tags: ["PostgreSQL", "Elixir", "Go", "TypeScript", "Realtime"],
    color: "#3ecf8e",
    initial: "S",
  },
];

// Helper to normalize slug
function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// ── GET /api/companies ────────────────────────────────────────────────────────
// Lists all hiring companies with their active open roles count.
companies.get("/", async (c) => {
  // Query all open jobs in D1 with creator's company
  const { results: jobs } = await c.env.DB.prepare(`
    SELECT j.id, j.title, j.created_at, j.status,
           u.id AS hr_id, u.name AS hr_name, u.company_name
    FROM jobs j
    LEFT JOIN users u ON u.id = j.user_id
    WHERE j.status = 'open'
  `).all<{
    id: string;
    title: string;
    created_at: string;
    status: string;
    hr_id: string | null;
    hr_name: string | null;
    company_name: string | null;
  }>();

  // Group jobs by company name
  const companyJobsMap: Record<string, { count: number; titles: string[] }> = {};
  for (const job of jobs || []) {
    const cName = job.company_name?.trim() || "HireSight Technologies";
    if (!companyJobsMap[cName]) {
      companyJobsMap[cName] = { count: 0, titles: [] };
    }
    companyJobsMap[cName].count++;
    companyJobsMap[cName].titles.push(job.title);
  }

  // Build unified company list
  const companyList: CompanyProfile[] = CURATED_COMPANIES.map((c) => {
    const jobInfo = companyJobsMap[c.name] || { count: 0, titles: [] };
    return {
      ...c,
      openRolesCount: Math.max(jobInfo.count, c.slug === "hiresight" ? (jobs?.length || 3) : (jobInfo.count || 2)),
    };
  });

  // Include any custom recruiter company from D1 not in curated list
  for (const [cName, info] of Object.entries(companyJobsMap)) {
    if (!companyList.some((c) => c.name.toLowerCase() === cName.toLowerCase())) {
      companyList.unshift({
        id: `comp-${toSlug(cName)}`,
        name: cName,
        slug: toSlug(cName),
        tagline: `Actively hiring for ${info.titles.slice(0, 2).join(", ")}`,
        description: `${cName} is actively building and scaling engineering, design, and operations teams on HireSight.`,
        industry: "Technology & Software",
        location: "Hybrid / Remote",
        size: "50-500 employees",
        website: "https://hiresight.app",
        founded: 2022,
        tags: ["Hiring Now", "Engineering", "Remote"],
        color: "#2563eb",
        initial: cName.charAt(0).toUpperCase(),
        openRolesCount: info.count,
      });
    }
  }

  return c.json(companyList);
});

// ── GET /api/companies/:slugOrId ──────────────────────────────────────────────
// Get detailed company profile with all open job postings.
companies.get("/:slugOrId", async (c) => {
  const param = c.req.param("slugOrId").toLowerCase();

  // Find in curated or fallback
  let profile = CURATED_COMPANIES.find(
    (comp) => comp.slug.toLowerCase() === param || comp.id.toLowerCase() === param || comp.name.toLowerCase() === param
  );

  // If not in curated, search D1 users
  if (!profile) {
    const hrUser = await c.env.DB.prepare(`
      SELECT company_name FROM users WHERE LOWER(company_name) = ? OR LOWER(id) = ? LIMIT 1
    `).bind(param, param).first<{ company_name: string }>();

    if (hrUser && hrUser.company_name) {
      profile = {
        id: `comp-${toSlug(hrUser.company_name)}`,
        name: hrUser.company_name,
        slug: toSlug(hrUser.company_name),
        tagline: "Innovative tech team scaling high-impact products",
        description: `${hrUser.company_name} is actively hiring exceptional talent to build next-generation applications.`,
        industry: "Technology",
        location: "Remote / Hybrid",
        size: "50-250 employees",
        website: "https://hiresight.app",
        founded: 2023,
        tags: ["Fast-Growing", "Engineering", "Collaborative"],
        color: "#3b82f6",
        initial: hrUser.company_name.charAt(0).toUpperCase(),
      };
    }
  }

  if (!profile) {
    // Default fallback to HireSight Technologies
    profile = CURATED_COMPANIES[0];
  }

  // Fetch open jobs for this company from D1
  const { results: rawJobs } = await c.env.DB.prepare(`
    SELECT j.id, j.title, j.description, j.created_at, j.status,
           COUNT(c.id) AS applicant_count
    FROM jobs j
    LEFT JOIN users u ON u.id = j.user_id
    LEFT JOIN candidates c ON c.job_id = j.id
    WHERE j.status = 'open' AND (LOWER(u.company_name) = ? OR ? = 'hiresight')
    GROUP BY j.id
    ORDER BY j.created_at DESC
  `).bind(profile.name.toLowerCase(), profile.slug).all<{
    id: string;
    title: string;
    description: string;
    created_at: string;
    status: string;
    applicant_count: number;
  }>();

  // If company has no direct jobs yet in D1, grab up to 3 open platform jobs so candidate can apply
  let jobs = rawJobs || [];
  if (jobs.length === 0) {
    const { results: fallbackJobs } = await c.env.DB.prepare(`
      SELECT j.id, j.title, j.description, j.created_at, j.status,
             COUNT(c.id) AS applicant_count
      FROM jobs j
      LEFT JOIN candidates c ON c.job_id = j.id
      WHERE j.status = 'open'
      GROUP BY j.id
      LIMIT 3
    `).all<{
      id: string;
      title: string;
      description: string;
      created_at: string;
      status: string;
      applicant_count: number;
    }>();
    jobs = fallbackJobs || [];
  }

  return c.json({
    company: {
      ...profile,
      openRolesCount: jobs.length,
    },
    jobs,
  });
});

export default companies;
