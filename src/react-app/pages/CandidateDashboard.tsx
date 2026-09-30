import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Sparkles, Clock3, CalendarDays, UserCheck, Briefcase } from "lucide-react";
import Seo from "../components/Seo";
import {
  authHeaders,
  pctDelta,
  scoreClass,
  stageBadgeClass,
  STATUS_LABEL,
  timeAgo,
} from "../lib/hr";

interface Application {
  id: string;
  application_id: string | null;
  job_id: string;
  job_title: string;
  score: number;
  reasoning: string;
  created_at: string;
  status: string | null;
}

const PIPELINE = [
  { key: "applied", label: "Applied" },
  { key: "under_review", label: "Under Review" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview", label: "Interview" },
  { key: "hired", label: "Hired" },
] as const;

function stageOf(app: Application): string {
  return app.status || "applied";
}

export default function CandidateDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const token = localStorage.getItem("token") ?? "";
  const name = localStorage.getItem("name") ?? "Candidate";
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadApplications() {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    fetch("/api/candidates/my-applications", { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load applications");
        return res.json() as Promise<Application[]>;
      })
      .then((data) => setApplications(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Error fetching applications"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${protocol}://${window.location.host}/api/status/ws?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; job_id: string; to_status: string };
          if (msg.type === "status_update") {
            setApplications((prev) =>
              prev.map((app) => (app.job_id === msg.job_id ? { ...app, status: msg.to_status } : app))
            );
            setFlashIds((ids) => {
              const next = new Set(ids);
              next.add(msg.job_id);
              setTimeout(() => {
                setFlashIds((s) => {
                  const n = new Set(s);
                  n.delete(msg.job_id);
                  return n;
                });
              }, 2500);
              return next;
            });
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        reconnectTimer.current = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [token]);

  const stats = useMemo(() => {
    const inProgress = applications.filter((a) => !["rejected", "hired"].includes(stageOf(a)));
    const shortlisted = applications.filter((a) => stageOf(a) === "shortlisted");
    const interview = applications.filter((a) => stageOf(a) === "interview");
    const scores = applications.map((a) => a.score).filter((n) => typeof n === "number");
    const best = scores.length ? Math.max(...scores) : null;
    const avg = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null;
    const pipeline = {
      applied: applications.filter((a) => stageOf(a) === "applied").length,
      under_review: applications.filter((a) => stageOf(a) === "under_review").length,
      shortlisted: shortlisted.length,
      interview: interview.length,
      hired: applications.filter((a) => stageOf(a) === "hired").length,
    };
    const recent = [...applications]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
    return { inProgress, shortlisted, interview, best, avg, pipeline, recent };
  }, [applications]);

  const kpis = [
    { label: "Applications", value: String(applications.length), icon: Briefcase, tone: "yellow", delta: null as ReturnType<typeof pctDelta> },
    { label: "In Progress", value: String(stats.inProgress.length), icon: Clock3, tone: "blue", delta: null as ReturnType<typeof pctDelta> },
    { label: "Shortlisted", value: String(stats.shortlisted.length), icon: Sparkles, tone: "pink", delta: null as ReturnType<typeof pctDelta> },
    { label: "Interviews", value: String(stats.interview.length), icon: CalendarDays, tone: "purple", delta: null as ReturnType<typeof pctDelta> },
    { label: "Best AI Score", value: stats.best === null ? "—" : `${stats.best}`, icon: UserCheck, tone: "green", delta: null as ReturnType<typeof pctDelta> },
  ];

  return (
    <div className="hr-page">
      <Seo title="Candidate Dashboard" description="Track your applications and AI match scores." noIndex />

      <div className="hr-page-head">
        <div>
          <h1>Application Dashboard</h1>
          <p>Overview of your hiring pipeline and AI match scores, {name}.</p>
        </div>
        <Link to="/jobs" className="btn btn-dark-pill">
          Browse Openings
        </Link>
      </div>

      {error && (
        <div className="hr-banner-error">
          {error}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadApplications}>
            Try again
          </button>
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
                {k.delta && <em className={k.delta.up ? "delta-up" : "delta-down"}>{k.delta.label}</em>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hr-panel">
        <div className="hr-panel-head">
          <h3>Your pipeline</h3>
        </div>
        <div className="hr-pipeline cols-5">
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

      <div className="hr-dash-grid cand-dash-grid">
        <div className="hr-panel">
          <div className="hr-panel-head">
            <h3>Recent activity</h3>
          </div>
          {loading ? (
            <p className="hr-muted">Loading activity…</p>
          ) : stats.recent.length === 0 ? (
            <div className="hr-empty-inline">Applications and status changes will show up here.</div>
          ) : (
            <ul className="hr-activity">
              {stats.recent.map((app) => (
                <li key={app.id}>
                  <div>
                    <strong>
                      {app.job_title} — {STATUS_LABEL[stageOf(app)] ?? "Applied"}
                    </strong>
                    <em>
                      {timeAgo(app.created_at)}
                      {typeof app.score === "number" ? ` · ${app.score} AI fit` : ""}
                    </em>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hr-panel">
          <div className="hr-panel-head">
            <h3>AI snapshot</h3>
          </div>
          {loading ? (
            <p className="hr-muted">Scoring…</p>
          ) : applications.length === 0 ? (
            <div className="hr-empty-inline">Apply to a role to get a Workers AI match score against the job description.</div>
          ) : (
            <div>
              <div className={`hr-score-big ${scoreClass(stats.avg)}`}>{stats.avg ?? "—"}</div>
              <p className="hr-muted" style={{ textAlign: "center" }}>Average fit across your applications</p>
              <p className="hr-score-copy">
                80+ is a strong fit. Keep your profile complete so recruiters can contact you if you are shortlisted.
              </p>
            </div>
          )}
        </div>

        <div className="hr-panel">
          <div className="hr-panel-head">
            <h3>Quick actions</h3>
          </div>
          <div className="hr-quick-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <Link to="/jobs" className="btn btn-dark-pill">
              <Briefcase size={14} /> Browse open roles
            </Link>
            <Link to="/candidate/profile" className="btn btn-secondary">
              <UserCheck size={14} /> Edit profile
            </Link>
          </div>
        </div>
      </div>

      <div className="hr-panel">
        <div className="hr-panel-head">
          <h3>My applications</h3>
          {!loading && <span className="hr-muted">{applications.length} records</span>}
        </div>

        {loading ? (
          <div className="hr-empty-block">Loading your applications…</div>
        ) : applications.length === 0 ? (
          <div className="hr-empty-block">
            <FileText size={40} strokeWidth={1.5} />
            <h3>No applications yet</h3>
            <p>Browse open roles and submit your resume to see AI match scores here.</p>
            <Link to="/jobs" className="btn btn-dark-pill">Browse Open Roles</Link>
          </div>
        ) : (
          <div className="table-container" style={{ boxShadow: "none", border: "none" }}>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job Title</th>
                    <th>Stage</th>
                    <th>AI Score</th>
                    <th>Applied</th>
                    <th>AI Feedback</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className={flashIds.has(app.job_id) ? "card-flash" : undefined}>
                      <td>
                        <Link to={`/jobs/${app.job_id}`} className="hr-table-title">{app.job_title}</Link>
                      </td>
                      <td>
                        <span className={`badge ${stageBadgeClass(stageOf(app))}`}>
                          {STATUS_LABEL[stageOf(app)] ?? "Applied"}
                        </span>
                      </td>
                      <td>
                        <span className={`score-pill ${scoreClass(app.score)}`}>{app.score}%</span>
                      </td>
                      <td>{timeAgo(app.created_at)}</td>
                      <td style={{ maxWidth: 280, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        {app.reasoning}
                      </td>
                      <td>
                        <Link to={`/jobs/${app.job_id}`} className="btn btn-secondary btn-sm">View job</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
