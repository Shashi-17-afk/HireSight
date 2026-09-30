import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Download, Plus, Search } from "lucide-react";
import Seo from "../components/Seo";
import {
  authHeaders,
  formatDate,
  inCurrentMonth,
  inPreviousMonth,
  initials,
  pctDelta,
  requisitionCode,
  scoreClass,
  sourceLabel,
  stageBadgeClass,
  stageOf,
  STATUS_LABEL,
  type HrCandidate,
} from "../lib/hr";

export default function CandidatesList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "pipeline">("list");

  const q = params.get("q") ?? "";
  const stage = params.get("stage") ?? "all";
  const screening = params.get("screening") ?? "all";

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/applications/all", { headers: authHeaders() })
      .then((r) => r.json() as Promise<{ candidates?: HrCandidate[] }>)
      .then((data) => setCandidates(data.candidates ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load candidates"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates.filter((c) => {
      const st = stageOf(c);
      if (stage !== "all" && st !== stage) return false;
      if (screening === "shortlist" && (c.ai_score ?? 0) < 80) return false;
      if (screening === "review" && (c.ai_score ?? 0) >= 80) return false;
      if (!needle) return true;
      return (
        c.candidate_name.toLowerCase().includes(needle) ||
        c.candidate_email.toLowerCase().includes(needle) ||
        c.job_title.toLowerCase().includes(needle) ||
        requisitionCode(c.job_id).toLowerCase().includes(needle)
      );
    });
  }, [candidates, q, stage, screening]);

  const thisMonth = candidates.filter((c) => inCurrentMonth(c.submitted_at)).length;
  const prevMonth = candidates.filter((c) => inPreviousMonth(c.submitted_at)).length;
  const inProgress = candidates.filter((c) => ["applied", "under_review", "shortlisted", "interview"].includes(stageOf(c))).length;
  const shortlisted = candidates.filter((c) => stageOf(c) === "shortlisted" || (c.ai_score ?? 0) >= 80).length;
  const rejected = candidates.filter((c) => stageOf(c) === "rejected").length;

  function exportCsv() {
    const rows = [
      ["Name", "Email", "Job", "Requisition", "Stage", "AI Score", "Source", "Applied On"],
      ...filtered.map((c) => [
        c.candidate_name,
        c.candidate_email,
        c.job_title,
        requisitionCode(c.job_id),
        STATUS_LABEL[stageOf(c)] ?? stageOf(c),
        c.ai_score === null ? "" : String(c.ai_score),
        sourceLabel(c.source),
        formatDate(c.applied_at || c.submitted_at),
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = [
    { label: "Total Candidates", value: candidates.length, delta: pctDelta(thisMonth, prevMonth) },
    { label: "New This Month", value: thisMonth, delta: pctDelta(thisMonth, prevMonth) },
    { label: "In Progress", value: inProgress, delta: null },
    { label: "Shortlist", value: shortlisted, delta: null },
    { label: "Rejected", value: rejected, delta: null },
  ];

  return (
    <div className="hr-page">
      <Seo title="Candidates & CV" description="Browse and manage candidates across all job requisitions." noIndex />

      <div className="hr-page-head">
        <div>
          <h1>Candidates & CV</h1>
          <p>Browse and manage candidates across all job requisitions.</p>
        </div>
        <div className="hr-page-actions">
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            <Download size={16} /> Export
          </button>
          <Link to="/hr/jobs/new" className="btn btn-dark-pill">
            <Plus size={16} /> Create Requisition
          </Link>
        </div>
      </div>

      <div className="hr-kpi-row">
        {kpis.map((k) => (
          <div key={k.label} className="hr-kpi-card compact">
            <div>
              <span className="hr-kpi-label">{k.label}</span>
              <strong>{loading ? "…" : k.value}</strong>
              {k.delta && <em className={k.delta.up ? "delta-up" : "delta-down"}>{k.delta.label}</em>}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="hr-banner-error">
          {error}
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button>
        </div>
      )}

      <div className="hr-toolbar">
        <div className="tab-bar">
          <button type="button" className={`tab-bar-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>Candidate List</button>
          <button type="button" className={`tab-bar-btn${view === "pipeline" ? " active" : ""}`} onClick={() => setView("pipeline")}>Candidate Pipeline</button>
        </div>
        <div className="hr-search in-page">
          <Search size={16} />
          <input value={q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Search by Requisition ID, Job Title…" />
        </div>
        <select className="form-input hr-select" value={stage} onChange={(e) => setFilter("stage", e.target.value)}>
          <option value="all">All Status</option>
          <option value="applied">Applied</option>
          <option value="under_review">Under Review</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interview">Interview</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="form-input hr-select" value={screening} onChange={(e) => setFilter("screening", e.target.value)}>
          <option value="all">All Screening</option>
          <option value="shortlist">AI Shortlist (80+)</option>
          <option value="review">Needs Review</option>
        </select>
      </div>

      {loading ? (
        <div className="hr-empty-block">Loading candidates…</div>
      ) : filtered.length === 0 ? (
        <div className="hr-empty-block">
          <h3>No candidates yet</h3>
          <p>Share an apply link or wait for applicants on the jobs board. AI scores appear as soon as a resume is submitted.</p>
        </div>
      ) : view === "pipeline" ? (
        <div className="hr-kanban">
          {["applied", "shortlisted", "interview", "hired"].map((col) => {
            const rows = filtered.filter((c) => stageOf(c) === col || (col === "applied" && stageOf(c) === "under_review"));
            return (
              <div key={col} className="hr-kanban-col">
                <h3>{STATUS_LABEL[col]} <span>{rows.length}</span></h3>
                {rows.map((c) => (
                  <button
                    type="button"
                    key={c.candidate_submission_id}
                    className="hr-kanban-card"
                    onClick={() => navigate(`/hr/candidate/${c.candidate_submission_id}?job_id=${c.job_id}`)}
                  >
                    <strong>{c.candidate_name}</strong>
                    <em>{c.job_title}</em>
                    <span className={`score-pill ${scoreClass(c.ai_score)}`}>{c.ai_score ?? "—"}%</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-container">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job Title</th>
                  <th>Stage</th>
                  <th>AI Score</th>
                  <th>Source</th>
                  <th>Applied On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.candidate_submission_id}>
                    <td>
                      <div className="hr-person">
                        <span className="hr-avatar">{initials(c.candidate_name)}</span>
                        <span>
                          <strong>{c.candidate_name}</strong>
                          <em>{c.candidate_email}</em>
                          <em>{requisitionCode(c.job_id)}</em>
                        </span>
                      </div>
                    </td>
                    <td>{c.job_title}</td>
                    <td>
                      <span className={`badge ${stageBadgeClass(stageOf(c))}`}>{STATUS_LABEL[stageOf(c)]}</span>
                      {(c.ai_score ?? 0) >= 80 && stageOf(c) !== "rejected" && (
                        <div className="hr-muted sm">Auto-shortlist</div>
                      )}
                    </td>
                    <td>
                      <span className={`score-pill ${scoreClass(c.ai_score)}`}>{c.ai_score ?? "—"}%</span>
                    </td>
                    <td>{sourceLabel(c.source)}</td>
                    <td>{formatDate(c.applied_at || c.submitted_at)}</td>
                    <td>
                      <div className="hr-inline-actions">
                        <Link to={`/hr/candidate/${c.candidate_submission_id}?job_id=${c.job_id}`} className="btn btn-secondary btn-sm">
                          View Profile
                        </Link>
                        <Link to={`/hr/candidate/${c.candidate_submission_id}?job_id=${c.job_id}`} className="btn btn-dark-pill btn-sm">
                          Interview
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
