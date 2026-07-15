import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Inbox, Search } from "lucide-react";
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
    return <span className="badge badge-green">{score}</span>;
  if (score >= 50)
    return <span className="badge badge-yellow">{score}</span>;
  return <span className="badge badge-red">{score}</span>;
}

function rankCell(rank: number, tied: boolean) {
  const cls =
    rank === 1 ? "rank-cell rank-1" : rank === 2 ? "rank-cell rank-2" : rank === 3 ? "rank-cell rank-3" : "rank-cell";
  const label = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  return (
    <td className={cls}>
      {label}
      {tied && (
        <span title="Tied score — earlier applicant ranked higher" style={{
          marginLeft: ".3rem", fontSize: ".65rem", fontWeight: 700,
          background: "var(--gray-100)", color: "var(--gray-500)",
          padding: ".1rem .3rem", borderRadius: 4, verticalAlign: "middle",
        }}>
          =
        </span>
      )}
    </td>
  );
}

export default function Dashboard() {
  const { job_id } = useParams<{ job_id: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [fitFilter, setFitFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyLink = `${window.location.origin}/apply/${job_id ?? ""}`;

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
  const strongFits = entries.filter((e) => e.score >= 80).length;

  // Search, fit category, and min-score filtering
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesFit = true;
    if (fitFilter === "strong") matchesFit = entry.score >= 80;
    else if (fitFilter === "potential") matchesFit = entry.score >= 50 && entry.score < 80;
    else if (fitFilter === "no-match") matchesFit = entry.score < 50;
    const matchesMin = entry.score >= minScore;
    return matchesSearch && matchesFit && matchesMin;
  });

  return (
    <div className="page-wide">
      <Seo title="Live Leaderboard" description="AI-ranked candidate leaderboard for this role." noIndex />
      <div className="dash-header">
        <div>
          <h1 className="page-title">Live Leaderboard</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Job ID: <code style={{ fontSize: ".78rem", background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", padding: ".15rem .45rem", borderRadius: 4 }}>{job_id}</code>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
          {status === "connected" && (
            <span className="live-pill"><span className="live-dot" /> LIVE</span>
          )}
          {status === "connecting" && <span className="connecting">Connecting…</span>}
          {status === "disconnected" && (
            <span className="connecting" style={{ color: "var(--red)" }}>Reconnecting…</span>
          )}
          <Link to="/hr/dashboard" className="btn btn-outline" style={{ fontSize: ".85rem", padding: ".45rem 1rem" }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Stats row */}
      {entries.length > 0 && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{entries.length}</div>
            <div className="stat-label">Candidates</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: topScore >= 80 ? "var(--green)" : topScore >= 50 ? "var(--yellow)" : "var(--red)" }}>
              {topScore}
            </div>
            <div className="stat-label">Top Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{strongFits}</div>
            <div className="stat-label">Strong Fits ≥80</div>
          </div>
        </div>
      )}

      {/* Apply link bar */}
      <div className="card-sm" style={{ marginBottom: "1.1rem", display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          Apply Link:
        </span>
        <code style={{ fontSize: ".78rem", color: "var(--text-muted)", wordBreak: "break-all", flex: 1 }}>
          {applyLink}
        </code>
        <Link
          to={`/apply/${job_id ?? ""}`}
          className="btn btn-outline"
          style={{ fontSize: ".8rem", padding: ".35rem .9rem", whiteSpace: "nowrap" }}
        >
          Open ↗
        </Link>
      </div>

      {/* Filter and Search Bar */}
      {entries.length > 0 && (
        <div className="filter-bar">
          <div className="search-input-wrap">
            <Search className="search-input-icon" size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search candidates by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={fitFilter}
            onChange={(e) => setFitFilter(e.target.value)}
          >
            <option value="all">All Fits</option>
            <option value="strong">Strong Fits (≥80)</option>
            <option value="potential">Potential (50–79)</option>
            <option value="no-match">No Match (&lt;50)</option>
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
            <label
              htmlFor="min-score"
              style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}
            >
              Min Score
            </label>
            <input
              id="min-score"
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Math.min(100, Math.max(0, Number(e.target.value))))}
              style={{
                width: 64,
                background: "var(--card-bg)",
                border: `1px solid ${minScore > 0 ? "var(--brand)" : "var(--card-border)"}`,
                borderRadius: 10,
                padding: ".6rem .75rem",
                color: minScore > 0 ? "var(--brand-light)" : "var(--text-primary)",
                fontSize: ".9rem",
                fontWeight: minScore > 0 ? 700 : 400,
                outline: "none",
                fontFamily: "inherit",
                boxShadow: minScore > 0 ? "0 0 0 3px var(--brand-glow)" : "none",
                transition: "all 0.2s ease",
              }}
            />
            {minScore > 0 && (
              <button
                onClick={() => setMinScore(0)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", fontSize: ".85rem", padding: ".2rem",
                  lineHeight: 1, fontFamily: "inherit",
                }}
                title="Clear min score filter"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        {entries.length === 0 ? (
          <div className="empty-state">
            {status === "connecting" ? (
              <>
                <span className="spinner" style={{ borderTopColor: "var(--brand)", marginBottom: "1rem" }} />
                <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: ".95rem" }}>Connecting to live feed…</p>
                <p style={{ color: "var(--text-secondary)" }}>Establishing WebSocket connection.</p>
              </>
            ) : (
              <>
                <div className="empty-state-icon">
                  <Inbox size={40} strokeWidth={1.5} />
                </div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: ".95rem" }}>No candidates yet</p>
                <p style={{ color: "var(--text-secondary)" }}>Share the apply link above to start receiving AI-scored applications. New candidates appear here in real time.</p>
              </>
            )}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={40} strokeWidth={1.5} />
            </div>
            <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: ".95rem" }}>No matches found</p>
            <p style={{ color: "var(--text-secondary)" }}>Try adjusting your search query or filter settings.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate</th>
                  <th>Score</th>
                  <th>AI Reasoning</th>
                  <th style={{ width: "5rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const entryIndex = entries.findIndex((e) => e.id === entry.id);
                  const tied =
                    (entryIndex > 0 && entries[entryIndex - 1].score === entry.score) ||
                    (entryIndex < entries.length - 1 && entries[entryIndex + 1].score === entry.score);
                  return (
                    <tr key={entry.id} className={newIds.has(entry.id) ? "row-new" : ""}>
                      {rankCell(entryIndex + 1, tied)}
                      <td style={{ fontWeight: 600 }}>{entry.name}</td>
                      <td>{scoreBadge(entry.score)}</td>
                      <td className="reasoning-text">{entry.reasoning}</td>
                      <td>
                        <Link
                          to={`/hr/candidate/${entry.id}?job_id=${job_id ?? ""}`}
                          className="btn btn-outline"
                          style={{ fontSize: ".75rem", padding: ".25rem .65rem", whiteSpace: "nowrap" }}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <span>
            {filteredEntries.length} of {entries.length} candidate{entries.length !== 1 ? "s" : ""} shown
            {minScore > 0 && <> · <strong style={{ color: "var(--brand-light)" }}>min score: {minScore}</strong></>}
            {" "}· avg score: <strong>{avgScore || "—"}</strong>
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: "1rem" }}>
            <span><span className="legend-dot" style={{ background: "var(--green)" }} />≥80 strong fit</span>
            <span><span className="legend-dot" style={{ background: "var(--yellow)" }} />50–79 potential</span>
            <span><span className="legend-dot" style={{ background: "var(--red)" }} />&lt;50 no match</span>
          </span>
        </div>
      </div>
    </div>
  );
}
