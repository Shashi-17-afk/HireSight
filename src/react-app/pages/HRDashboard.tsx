import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Gauge,
  Sparkles,
  CalendarDays,
  UserCheck,
  Plus,
  FileText,
  Users,
  Clock3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Seo from "../components/Seo";
import {
  authHeaders,
  inCurrentMonth,
  inPreviousMonth,
  initials,
  pctDelta,
  requisitionCode,
  scoreClass,
  stageBadgeClass,
  stageOf,
  STATUS_LABEL,
  timeAgo,
  type HrCandidate,
  type HrJob,
} from "../lib/hr";

const PIPELINE = [
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
  { key: "applications", label: "Applications" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview", label: "Interview" },
  { key: "offers", label: "Offers" },
  { key: "hired", label: "Hired" },
] as const;

function CalendarCard({ interviewCount }: { interviewCount: number }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="hr-panel">
      <div className="hr-panel-head">
        <h3>Upcoming Interviews</h3>
      </div>
      <div className="hr-cal-nav">
        <strong>{label}</strong>
        <span>
          <button type="button" className="hr-icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className="hr-icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
            <ChevronRight size={14} />
          </button>
        </span>
      </div>
      <div className="hr-cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d} className="hr-cal-dow">{d}</span>
        ))}
        {cells.map((day, i) => {
          const isToday =
            day !== null &&
            day === now.getDate() &&
            month === now.getMonth() &&
            year === now.getFullYear();
          return (
            <span key={i} className={`hr-cal-day${isToday ? " is-today" : ""}`}>
              {day ?? ""}
            </span>
          );
        })}
      </div>
      <div className="hr-cal-empty">
        <p>Upcoming schedule</p>
        <span>
          {interviewCount === 0
            ? "No interviews scheduled. Move a shortlisted candidate to Interview to track them here."
            : `${interviewCount} candidate${interviewCount === 1 ? "" : "s"} currently in the interview stage.`}
        </span>
      </div>
    </div>
  );
}

export default function HRDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<HrJob[]>([]);
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const userName = localStorage.getItem("name") || "Recruiter";

  function load() {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/jobs", { headers: authHeaders() }).then((r) => r.json() as Promise<{ jobs?: HrJob[] }>),
      fetch("/api/applications/all", { headers: authHeaders() }).then((r) => r.json() as Promise<{ candidates?: HrCandidate[] }>),
    ])
      .then(([jobsData, candData]) => {
        setJobs(jobsData.jobs ?? []);
        setCandidates(candData.candidates ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const openJobs = jobs.filter((j) => (j.status ?? "open") === "open");
    const applicantTotal = candidates.length;
    const shortlisted = candidates.filter((c) => stageOf(c) === "shortlisted");
    const interview = candidates.filter((c) => stageOf(c) === "interview");
    const hired = candidates.filter((c) => stageOf(c) === "hired");
    const scores = candidates.map((c) => c.ai_score).filter((n): n is number => typeof n === "number");
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const quality = Math.round((avgScore / 10) * 10) / 10;
    const efficiency = applicantTotal ? Math.round((hired.length / applicantTotal) * 1000) / 10 : 0;

    const jobsThis = jobs.filter((j) => inCurrentMonth(j.created_at)).length;
    const jobsPrev = jobs.filter((j) => inPreviousMonth(j.created_at)).length;
    const hiredThis = hired.filter((c) => inCurrentMonth(c.updated_at || c.submitted_at)).length;
    const hiredPrev = hired.filter((c) => inPreviousMonth(c.updated_at || c.submitted_at)).length;
    const interviewThis = interview.filter((c) => inCurrentMonth(c.updated_at || c.submitted_at)).length;
    const interviewPrev = interview.filter((c) => inPreviousMonth(c.updated_at || c.submitted_at)).length;

    const recent = [...candidates]
      .sort((a, b) => new Date(b.updated_at || b.submitted_at).getTime() - new Date(a.updated_at || a.submitted_at).getTime())
      .slice(0, 6);

    const shortlists = [...candidates]
      .filter((c) => (c.ai_score ?? 0) >= 80)
      .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
      .slice(0, 4);

    return {
      openJobs,
      applicantTotal,
      shortlisted,
      interview,
      hired,
      quality,
      efficiency,
      jobsThis,
      jobsPrev,
      hiredThis,
      hiredPrev,
      interviewThis,
      interviewPrev,
      recent,
      shortlists,
      pipeline: {
        requested: 0,
        approved: openJobs.length,
        published: openJobs.length,
        applications: applicantTotal,
        shortlisted: shortlisted.length,
        interview: interview.length,
        offers: 0,
        hired: hired.length,
      },
    };
  }, [jobs, candidates]);

  const kpis = [
    {
      label: "Open Requisition",
      value: String(stats.openJobs.length),
      icon: Briefcase,
      tone: "yellow",
      delta: pctDelta(stats.jobsThis, stats.jobsPrev),
    },
    {
      label: "Pipeline Efficiency",
      value: `${stats.efficiency}%`,
      icon: Gauge,
      tone: "green",
      delta: null as ReturnType<typeof pctDelta>,
    },
    {
      label: "Recruitment Quality",
      value: stats.quality ? `${stats.quality}/10` : "—",
      icon: Sparkles,
      tone: "pink",
      delta: null as ReturnType<typeof pctDelta>,
    },
    {
      label: "Interviews Scheduled",
      value: String(stats.interview.length),
      icon: CalendarDays,
      tone: "purple",
      delta: pctDelta(stats.interviewThis, stats.interviewPrev),
    },
    {
      label: "Hires This Month",
      value: String(stats.hiredThis),
      icon: UserCheck,
      tone: "blue",
      delta: pctDelta(stats.hiredThis, stats.hiredPrev),
    },
  ];

  return (
    <div className="hr-page">
      <Seo title="Recruitment Dashboard" description="Overview of hiring pipeline and recruitment activity." noIndex />

      <div className="hr-page-head">
        <div>
          <h1>Recruitment Dashboard</h1>
          <p>Overview of hiring pipeline and recruitment activity for {userName}.</p>
        </div>
        <Link to="/hr/jobs/new" className="btn btn-dark-pill">
          <Plus size={16} /> New Recruitment Request
        </Link>
      </div>

      {error && (
        <div className="hr-banner-error">
          {error}
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button>
        </div>
      )}

      <div className="hr-kpi-row">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="hr-kpi-card">
              <div className={`hr-kpi-icon tone-${k.tone}`}>
                <Icon size={18} />
              </div>
              <div>
                <span className="hr-kpi-label">{k.label}</span>
                <strong>{loading ? "…" : k.value}</strong>
                {k.delta && (
                  <em className={k.delta.up ? "delta-up" : "delta-down"}>{k.delta.label}</em>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hr-panel">
        <div className="hr-panel-head">
          <h3>Recruitment pipeline</h3>
        </div>
        <div className="hr-pipeline">
          {PIPELINE.map((step, i) => (
            <div key={step.key} className="hr-pipe-step">
              {i > 0 && <div className="hr-pipe-line" />}
              <span className={`hr-pipe-dot${stats.pipeline[step.key] > 0 ? " is-filled" : ""}`} />
              <small>{step.label}</small>
              <b>{loading ? "—" : stats.pipeline[step.key]}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="hr-dash-grid">
        <div className="hr-panel">
          <div className="hr-panel-head">
            <h3>Pending Approvals</h3>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Task Detail</th>
                  <th>Requested By</th>
                  <th>Status</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="hr-empty-inline">
            Jobs publish immediately after you create them. There is no approval queue in HireSight.
          </div>
        </div>

        <div className="hr-panel">
          <div className="hr-panel-head">
            <h3>Recent Activities</h3>
          </div>
          {loading ? (
            <p className="hr-muted">Loading activity…</p>
          ) : stats.recent.length === 0 ? (
            <div className="hr-empty-inline">New applications and status changes will appear here.</div>
          ) : (
            <ul className="hr-activity">
              {stats.recent.map((c) => (
                <li key={c.candidate_submission_id}>
                  <span className="hr-avatar sm">{initials(c.candidate_name)}</span>
                  <div>
                    <strong>
                      {c.candidate_name} — {STATUS_LABEL[stageOf(c)] ?? "Applied"}
                    </strong>
                    <em>{c.job_title} · {timeAgo(c.updated_at || c.submitted_at)}</em>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CalendarCard interviewCount={stats.interview.length} />
      </div>

      <div className="hr-panel">
        <div className="hr-panel-head">
          <h3>Quick Actions</h3>
        </div>
        <div className="hr-quick-actions">
          <button type="button" onClick={() => navigate("/hr/jobs/new")}><Plus size={14} /> Raise Manpower Request</button>
          <button type="button" onClick={() => navigate("/hr/jobs/new")}><FileText size={14} /> Create Job Description</button>
          <button type="button" onClick={() => navigate("/hr/candidates")}><Users size={14} /> Review Candidates</button>
          <button type="button" onClick={() => navigate("/hr/candidates?stage=interview")}><Clock3 size={14} /> Schedule Interview</button>
          <button type="button" onClick={() => navigate("/hr/candidates?stage=hired")}><UserCheck size={14} /> Create Offer</button>
        </div>
      </div>

      <div className="hr-panel">
        <div className="hr-panel-head">
          <h3>AI Shortlists</h3>
          <Link to="/hr/candidates" className="hr-text-link">Review now</Link>
        </div>
        {loading ? (
          <p className="hr-muted">Scoring top matches…</p>
        ) : stats.shortlists.length === 0 ? (
          <div className="hr-empty-inline">
            Candidates scoring 80+ AI fit will auto-shortlist here after they apply.
          </div>
        ) : (
          <div className="hr-shortlist">
            {stats.shortlists.map((c) => (
              <Link
                key={c.candidate_submission_id}
                to={`/hr/candidate/${c.candidate_submission_id}?job_id=${c.job_id}`}
                className="hr-shortlist-row"
              >
                <span className="hr-avatar">{initials(c.candidate_name)}</span>
                <span>
                  <strong>{c.candidate_name}</strong>
                  <em>{c.job_title} · {requisitionCode(c.job_id)}</em>
                </span>
                <span className={`score-pill ${scoreClass(c.ai_score)}`}>{c.ai_score ?? "—"}%</span>
                <span className={`badge ${stageBadgeClass(stageOf(c))}`}>
                  {STATUS_LABEL[stageOf(c)]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
