export interface HrJob {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status?: string;
  applicant_count?: number;
}

export interface HrCandidate {
  candidate_submission_id: string;
  candidate_name: string;
  candidate_email: string;
  ai_score: number | null;
  ai_reasoning: string | null;
  submitted_at: string;
  job_id: string;
  job_title: string;
  job_status: string | null;
  application_id: string | null;
  user_id: string | null;
  status: string | null;
  source: string | null;
  applied_at: string | null;
  updated_at: string | null;
  phone: string | null;
  headline: string | null;
  skills: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  resume_url: string | null;
}

export const STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  rejected: "Not Selected",
  hired: "Hired",
  offered: "Offer Extended",
  open: "Open",
  closed: "Closed",
  draft: "Draft",
};

export function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function parseTimestamp(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // D1 CURRENT_TIMESTAMP is UTC with no timezone: "YYYY-MM-DD HH:MM:SS".
  // `new Date("2026-09-30 07:44:00")` is treated as local time in the browser,
  // which shifts IST (UTC+5:30) by ~5 hours. Append Z so it is read as UTC.
  const hasZone = /[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed);
  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const d = new Date(hasZone ? trimmed : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function timeAgo(dateStr: string | null | undefined): string {
  const parsed = parseTimestamp(dateStr);
  if (!parsed) return "recently";
  const diff = Date.now() - parsed.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months} mo ago`;
}

export function formatDate(dateStr: string | null | undefined): string {
  const d = parseTimestamp(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function requisitionCode(jobId: string): string {
  return `REQ-${jobId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function stageOf(candidate: HrCandidate): string {
  return candidate.status || "applied";
}

export function sourceLabel(source: string | null): string {
  if (source === "browse") return "Jobs Board";
  if (source === "link") return "Apply Link";
  return "Application Form";
}

export function pctDelta(current: number, previous: number): { label: string; up: boolean } | null {
  if (previous <= 0 && current <= 0) return null;
  if (previous <= 0) return { label: "New this month", up: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { label: `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% from last month`, up: pct >= 0 };
}

export function scoreClass(score: number | null): string {
  if (score === null) return "score-mid";
  if (score >= 80) return "score-high";
  if (score >= 50) return "score-mid";
  return "score-low";
}

export function stageBadgeClass(status: string | null): string {
  if (status === "hired" || status === "shortlisted") return "badge-green";
  if (status === "interview" || status === "offered") return "badge-blue";
  if (status === "rejected") return "badge-red";
  if (status === "under_review") return "badge-yellow";
  return "badge-blue";
}

export function inCurrentMonth(dateStr: string | null | undefined, now = new Date()): boolean {
  const d = parseTimestamp(dateStr);
  if (!d) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function inPreviousMonth(dateStr: string | null | undefined, now = new Date()): boolean {
  const d = parseTimestamp(dateStr);
  if (!d) return false;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
}
