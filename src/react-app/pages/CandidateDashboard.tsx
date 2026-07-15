import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import Seo from "../components/Seo";
import AnimatedStatusBadge from "../components/AnimatedStatusBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreBadge(score: number) {
  if (score >= 80) return <span className="badge badge-green">{score} / 100</span>;
  if (score >= 50) return <span className="badge badge-yellow">{score} / 100</span>;
  return <span className="badge badge-red">{score} / 100</span>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidateDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token") ?? "";
  const name  = localStorage.getItem("name") ?? "Candidate";

  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  function loadApplications() {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError("");
    fetch("/api/candidates/my-applications", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load applications");
        return res.json() as Promise<Application[]>;
      })
      .then((data) => setApplications(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Error fetching applications"))
      .finally(() => setLoading(false));
  }

  // Fetch applications on mount
  useEffect(() => {
    loadApplications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Real-time status push via CandidateStatusDO WebSocket
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
              prev.map((app) => app.job_id === msg.job_id ? { ...app, status: msg.to_status } : app)
            );
            // Brief highlight flash on the updated card
            setFlashIds((ids) => {
              const next = new Set(ids);
              next.add(msg.job_id);
              setTimeout(() => setFlashIds((s) => { const n = new Set(s); n.delete(msg.job_id); return n; }), 2500);
              return next;
            });
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => { reconnectTimer.current = setTimeout(connect, 4000); };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [token]);

  return (
    <div className="page">
      <Seo title="My Applications" description="Track your job applications and AI scores on HireSight." noIndex />

      {/* Header ──────────────────────────────────────────────────────────── */}
      <div className="dash-header" style={{ marginBottom: "1.75rem" }}>
        <div>
          <h1 className="page-title">Candidate Portal</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Welcome back, <strong style={{ color: "var(--text-primary)" }}>{name}</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link to="/candidate/profile" className="btn btn-outline" style={{ fontSize: ".82rem" }}>
            Edit Profile
          </Link>
          <Link to="/jobs" className="btn btn-primary" style={{ fontSize: ".82rem" }}>
            Browse Openings →
          </Link>
        </div>
      </div>

      {/* My Applications ─────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-secondary)" }}>
        My Applications
        {!loading && applications.length > 0 && (
          <span style={{ marginLeft: ".5rem", fontWeight: 400, color: "var(--text-muted)", fontSize: ".85rem" }}>
            ({applications.length})
          </span>
        )}
      </h2>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
          <span className="spinner" style={{ width: "32px", height: "32px" }} />
          <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>Loading your applications…</p>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>⚠️</div>
          <p style={{ color: "var(--red)", marginBottom: "1.25rem" }}>{error}</p>
          <button onClick={loadApplications} className="btn btn-outline" style={{ fontSize: ".85rem" }}>
            Try Again
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div className="empty-state-icon">
            <FileText size={40} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: ".5rem" }}>
            No applications yet
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "340px", margin: "0 auto 1.5rem" }}>
            Browse open roles and submit your resume to see AI match scores and track your application status here.
          </p>
          <Link to="/jobs" className="btn btn-primary">Browse Open Roles →</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {applications.map((app) => (
            <div key={app.id} className={`card${flashIds.has(app.job_id) ? " card-flash" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: ".75rem", marginBottom: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: ".3rem" }}>
                    {app.job_title}
                  </h2>
                  <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
                    {timeAgo(app.created_at)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <AnimatedStatusBadge status={app.status} />
                  {scoreBadge(app.score)}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid var(--card-border)", borderRadius: "8px", padding: "1rem" }}>
                <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".4rem" }}>
                  🤖 AI Feedback
                </div>
                <p style={{ fontSize: ".875rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {app.reasoning}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
