import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Inbox, Search, ArrowLeft, ExternalLink, Copy, Check, Radio } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Seo from "../components/Seo";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  reasoning: string;
  submittedAt?: number;
}

type WsStatus = "connecting" | "connected" | "disconnected";

function scoreBadge(score: number) {
  if (score >= 80)
    return <span className="score-pill score-high">★ {score} Fit</span>;
  if (score >= 50)
    return <span className="score-pill score-mid">● {score} Fit</span>;
  return <span className="score-pill score-low">▲ {score} Fit</span>;
}

function rankCell(rank: number, tied: boolean) {
  const label = rank === 1 ? "🥇 #1" : rank === 2 ? "🥈 #2" : rank === 3 ? "🥉 #3" : `#${rank}`;
  return (
    <td style={{ fontWeight: 700, fontFamily: "var(--font-heading)" }}>
      {label}
      {tied && (
        <span title="Tied score — earlier applicant ranked higher" style={{
          marginLeft: "0.3rem", fontSize: "0.65rem", fontWeight: 700,
          background: "var(--card-bg-alt)", color: "var(--text-muted)",
          padding: "0.1rem 0.35rem", borderRadius: "var(--radius-full)", verticalAlign: "middle"
        }}>
          =
        </span>
      )}
    </td>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  rank: number;
  tied: boolean;
  isNew: boolean;
  jobId: string;
}

function LeaderboardRow({ entry, rank, tied, isNew, jobId }: LeaderboardRowProps) {
  const reduceMotion = useReducedMotion();

  const cells = (
    <>
      {rankCell(rank, tied)}
      <td style={{ fontWeight: 700, fontFamily: "var(--font-heading)", fontSize: "1rem" }}>{entry.name}</td>
      <td>{scoreBadge(entry.score)}</td>
      <td style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.5, maxWidth: "420px" }}>{entry.reasoning}</td>
      <td>
        <Link
          to={`/hr/candidate/${entry.id}?job_id=${jobId}`}
          className="btn btn-dark-pill btn-sm"
          style={{ whiteSpace: "nowrap" }}
        >
          View Candidate →
        </Link>
      </td>
    </>
  );

  if (reduceMotion) {
    return <tr key={entry.id}>{cells}</tr>;
  }

  return (
    <motion.tr
      layout="position"
      initial={isNew ? { backgroundColor: "rgba(249, 195, 90, 0.3)" } : false}
      animate={{ backgroundColor: "rgba(255, 255, 255, 0)" }}
      transition={{
        layout: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
        backgroundColor: { duration: 2, ease: "easeOut" },
      }}
    >
      {cells}
    </motion.tr>
  );
}

export default function Dashboard() {
  const { job_id } = useParams<{ job_id: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [fitFilter, setFitFilter] = useState("all");
  const [copied, setCopied] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyLink = `${window.location.origin}/apply/${job_id ?? ""}`;

  function copyLink() {
    void navigator.clipboard.writeText(applyLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (!job_id) return;

    function connect() {
      const token = localStorage.getItem("token") ?? "";
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${protocol}://${window.location.host}/api/leaderboard/${job_id}/ws?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (event: MessageEvent<string>) => {
        const msg = JSON.parse(event.data) as {
          type: string;
          entries: LeaderboardEntry[];
        };
        if (msg.type === "leaderboard") {
          setEntries((prev) => {
            const prevIds = new Set(prev.map((e) => e.id));
            const incoming = msg.entries;
            const fresh = incoming
              .filter((e) => !prevIds.has(e.id))
              .map((e) => e.id);
            if (fresh.length > 0) {
              setNewIds((ids) => {
                const next = new Set(ids);
                fresh.forEach((id) => next.add(id));
                setTimeout(
                  () =>
                    setNewIds((ids2) => {
                      const n = new Set(ids2);
                      fresh.forEach((id) => n.delete(id));
                      return n;
                    }),
                  2000
                );
                return next;
              });
            }
            return incoming;
          });
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [job_id]);

  const avgScore = entries.length
    ? Math.round(entries.reduce((sum, e) => sum + e.score, 0) / entries.length)
    : 0;
  const topScore = entries.length ? entries[0].score : 0;

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesFit = true;
    if (fitFilter === "strong") matchesFit = entry.score >= 80;
    else if (fitFilter === "potential") matchesFit = entry.score >= 50 && entry.score < 80;
    else if (fitFilter === "no-match") matchesFit = entry.score < 50;
    return matchesSearch && matchesFit;
  });

  return (
    <div className="page-wide">
      <Seo title="Live Candidate Leaderboard" description="AI-ranked candidate leaderboard for this role." noIndex />

      {/* Header Banner */}
      <div className="card dash-card-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <span className="section-tag" style={{ margin: 0 }}>Live Leaderboard</span>
            {status === "connected" && (
              <span className="badge badge-green">
                <Radio size={12} style={{ animation: "pulse 2s infinite" }} /> Connected Live
              </span>
            )}
            {status === "connecting" && <span className="badge badge-yellow">Connecting...</span>}
            {status === "disconnected" && <span className="badge badge-red">Reconnecting...</span>}
          </div>
          <h1 className="dash-title">
            Real-Time <span className="pill-highlight pill-pink">Candidate Rankings</span>
          </h1>
        </div>

        <div className="dash-header-actions">
          <Link to="/hr/dashboard" className="btn btn-secondary btn-lg">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      {entries.length > 0 && (
        <div className="grid-3" style={{ marginBottom: "2rem" }}>
          <div className="card-flat">
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Applicants</div>
            <div className="metric-value">{entries.length}</div>
          </div>
          <div className="card-flat">
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Top Match Score</div>
            <div className="metric-value" style={{ color: topScore >= 80 ? "var(--status-green)" : "var(--status-yellow)" }}>
              {topScore}
            </div>
          </div>
          <div className="card-flat">
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Average Fit Score</div>
            <div className="metric-value">{avgScore}</div>
          </div>
        </div>
      )}

      {/* Shareable Apply Bar */}
      <div className="card-flat" style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "260px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-heading)" }}>Apply Link: </span>
          <code style={{ fontSize: "0.85rem", color: "var(--text-secondary)", wordBreak: "break-all" }}>{applyLink}</code>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", width: "100%" }}>
          <button className="btn btn-secondary btn-sm" onClick={copyLink} type="button" style={{ flex: 1, minWidth: "140px" }}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Apply Link</>}
          </button>
          <Link to={`/apply/${job_id ?? ""}`} target="_blank" className="btn btn-dark-pill btn-sm" style={{ flex: 1, minWidth: "140px" }}>
            Open Apply Page <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {/* Filter Controls */}
      {entries.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
            <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "2.6rem" }}
              placeholder="Search candidate name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="form-input"
            style={{ width: "100%", maxWidth: "100%" }}
            value={fitFilter}
            onChange={(e) => setFitFilter(e.target.value)}
          >
            <option value="all">All Fit Levels</option>
            <option value="strong">Strong Fits (≥80)</option>
            <option value="potential">Potential Fits (50–79)</option>
            <option value="no-match">Low Fits (&lt;50)</option>
          </select>
        </div>
      )}

      {/* Leaderboard Table Container */}
      <div className="table-container">
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
            {status === "connecting" ? (
              <p style={{ fontSize: "1.05rem", color: "var(--text-muted)" }}>Connecting to live WebSocket feed...</p>
            ) : (
              <>
                <Inbox size={44} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
                <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>No applications yet</h3>
                <p style={{ color: "var(--text-secondary)", maxWidth: "480px", margin: "0 auto 1.5rem" }}>
                  Share the apply link with candidates. New resume applications will score instantly and appear on this leaderboard in real time.
                </p>
                <button className="btn btn-dark-pill" onClick={copyLink} type="button">
                  {copied ? <><Check size={16} /> Link Copied</> : <><Copy size={16} /> Copy Apply Link</>}
                </button>
              </>
            )}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
            <Search size={44} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
            <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>No matching candidates</h3>
            <p style={{ color: "var(--text-secondary)" }}>Try adjusting your search query or filter settings.</p>
          </div>
        ) : (
          <>
            <div className="leaderboard-cards">
              {filteredEntries.map((entry) => {
                const entryIndex = entries.findIndex((e) => e.id === entry.id);
                const rank = entryIndex + 1;
                const rankLabel = rank === 1 ? "🥇 #1" : rank === 2 ? "🥈 #2" : rank === 3 ? "🥉 #3" : `#${rank}`;
                return (
                  <div key={entry.id} className="leaderboard-card">
                    <div className="leaderboard-card-header">
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                          {rankLabel}
                        </div>
                        <div style={{ fontWeight: 700, fontFamily: "var(--font-heading)", fontSize: "1.05rem" }}>
                          {entry.name}
                        </div>
                      </div>
                      {scoreBadge(entry.score)}
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "0.85rem" }}>
                      {entry.reasoning}
                    </p>
                    <Link
                      to={`/hr/candidate/${entry.id}?job_id=${job_id ?? ""}`}
                      className="btn btn-dark-pill btn-sm"
                      style={{ width: "100%" }}
                    >
                      View Candidate →
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="table-scroll table-desktop-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Rank</th>
                    <th>Candidate Name</th>
                    <th style={{ width: "140px" }}>AI Fit Score</th>
                    <th>Workers AI Reasoning</th>
                    <th style={{ width: "160px" }}>Action</th>
                  </tr>
                </thead>
                <LayoutGroup id="leaderboard">
                  <tbody>
                    {filteredEntries.map((entry) => {
                      const entryIndex = entries.findIndex((e) => e.id === entry.id);
                      const tied =
                        (entryIndex > 0 && entries[entryIndex - 1].score === entry.score) ||
                        (entryIndex < entries.length - 1 && entries[entryIndex + 1].score === entry.score);
                      return (
                        <LeaderboardRow
                          key={entry.id}
                          entry={entry}
                          rank={entryIndex + 1}
                          tied={tied}
                          isNew={newIds.has(entry.id)}
                          jobId={job_id ?? ""}
                        />
                      );
                    })}
                  </tbody>
                </LayoutGroup>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}