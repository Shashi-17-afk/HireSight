import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  reasoning: string;
}

type WsStatus = "connecting" | "connected" | "disconnected";

function scoreBadge(score: number) {
  if (score >= 80)
    return <span className="badge badge-green">{score}</span>;
  if (score >= 50)
    return <span className="badge badge-yellow">{score}</span>;
  return <span className="badge badge-red">{score}</span>;
}

function rankCell(rank: number) {
  const cls =
    rank === 1 ? "rank-cell rank-1" : rank === 2 ? "rank-cell rank-2" : rank === 3 ? "rank-cell rank-3" : "rank-cell";
  return <td className={cls}>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}</td>;
}

export default function Dashboard() {
  const { job_id } = useParams<{ job_id: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyLink = `${window.location.origin}/apply/${job_id ?? ""}`;

  useEffect(() => {
    if (!job_id) return;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${protocol}://${window.location.host}/api/leaderboard/${job_id}/ws`
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

  return (
    <div className="page-wide">
      <div className="dash-header">
        <div>
          <h1 className="page-title">Live Leaderboard</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Job ID: <code style={{ fontSize: ".8rem" }}>{job_id}</code>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
          {status === "connected" && (
            <span className="live-pill">
              <span className="live-dot" /> LIVE
            </span>
          )}
          {status === "connecting" && <span className="connecting">Connecting…</span>}
          {status === "disconnected" && (
            <span className="connecting" style={{ color: "var(--red)" }}>Reconnecting…</span>
          )}
          <Link to="/" className="btn btn-outline" style={{ fontSize: ".85rem", padding: ".45rem 1rem" }}>
            ← Post a Job
          </Link>
        </div>
      </div>

      {/* Candidate apply link */}
      <div className="card" style={{ marginBottom: "1.25rem", padding: "1rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: ".875rem", fontWeight: 600, color: "var(--gray-700)", whiteSpace: "nowrap" }}>
            Candidate Apply Link:
          </span>
          <code style={{ fontSize: ".8rem", color: "var(--gray-600)", wordBreak: "break-all" }}>
            {applyLink}
          </code>
          <Link
            to={`/apply/${job_id ?? ""}`}
            className="btn btn-outline"
            style={{ fontSize: ".8rem", padding: ".35rem .9rem", whiteSpace: "nowrap" }}
          >
            Open Apply Page
          </Link>
        </div>
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem" }}>📭</div>
            <p>No candidates yet. Share the apply link to get started!</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Score</th>
                  <th>AI Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={entry.id}
                    style={
                      newIds.has(entry.id)
                        ? { background: "#fefce8", transition: "background 2s" }
                        : {}
                    }
                  >
                    {rankCell(i + 1)}
                    <td style={{ fontWeight: 600 }}>{entry.name}</td>
                    <td>{scoreBadge(entry.score)}</td>
                    <td className="reasoning-text">{entry.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--gray-100)",
            fontSize: ".8rem",
            color: "var(--gray-400)",
          }}
        >
          {entries.length} candidate{entries.length !== 1 ? "s" : ""} ranked •{" "}
          <span style={{ color: "var(--green)" }}>≥80</span> strong fit •{" "}
          <span style={{ color: "var(--yellow)" }}>50–79</span> potential •{" "}
          <span style={{ color: "var(--red)" }}>{"<50"}</span> not a match
        </div>
      </div>
    </div>
  );
}
