import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Copy, Check, ArrowRight, Trash2, MoreHorizontal, Download } from "lucide-react";
import Seo from "../components/Seo";
import {
  authHeaders,
  formatDate,
  inCurrentMonth,
  inPreviousMonth,
  initials,
  pctDelta,
  requisitionCode,
  timeAgo,
  type HrJob,
} from "../lib/hr";

export default function JobRequisitions() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<HrJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrJob | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const q = params.get("q") ?? "";
  const statusFilter = params.get("status") ?? "all";
  const userName = localStorage.getItem("name") || "Recruiter";

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/jobs", { headers: authHeaders() })
      .then((r) => r.json() as Promise<{ jobs?: HrJob[] }>)
      .then((data) => setJobs(data.jobs ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      const status = j.status ?? "open";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!needle) return true;
      return (
        j.title.toLowerCase().includes(needle) ||
        j.id.toLowerCase().includes(needle) ||
        requisitionCode(j.id).toLowerCase().includes(needle)
      );
    });
  }, [jobs, q, statusFilter]);

  const openCount = jobs.filter((j) => (j.status ?? "open") === "open").length;
  const closedCount = jobs.filter((j) => j.status === "closed").length;

  function copyLink(jobId: string) {
    void navigator.clipboard.writeText(`${window.location.origin}/apply/${jobId}`);
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function exportCsv() {
    const rows = [
      ["Requisition ID", "Job Title", "Status", "Applicants", "Requested On"],
      ...filtered.map((j) => [
        requisitionCode(j.id),
        j.title,
        j.status ?? "open",
        String(j.applicant_count ?? 0),
        formatDate(j.created_at),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "job-requisitions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete job");
      setJobs((prev) => prev.filter((j) => j.id !== deleteTarget.id));
      setToast(`Job role "${deleteTarget.title}" permanently deleted.`);
      setDeleteTarget(null);
      setConfirmTitle("");
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeleting(false);
    }
  }

  const kpis = [
    { label: "Total Requisitions", value: jobs.length, delta: pctDelta(jobs.filter((j) => inCurrentMonth(j.created_at)).length, jobs.filter((j) => inPreviousMonth(j.created_at)).length) },
    { label: "Open Requisitions", value: openCount, delta: null },
    { label: "Pending Approvals", value: 0, delta: null },
    { label: "Approved", value: openCount, delta: null },
    { label: "Closed", value: closedCount, delta: null },
  ];

  return (
    <div className="hr-page">
      <Seo title="Job Requisitions" description="Manage and track job requisitions." noIndex />

      <div className="hr-page-head">
        <div>
          <h1>Job Requisitions</h1>
          <p>Manage and track all job requisitions across the organization.</p>
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

      {toast && <div className="hr-toast">{toast}</div>}
      {error && (
        <div className="hr-banner-error">
          {error}
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button>
        </div>
      )}

      <div className="hr-toolbar">
        <div className="hr-search in-page">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Search by title, ID, department or name…"
          />
        </div>
        <select className="form-input hr-select" value={statusFilter} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="hr-empty-block">Loading requisitions…</div>
        ) : filtered.length === 0 ? (
          <div className="hr-empty-block">
            <h3>No requisitions found</h3>
            <p>Create a job to generate an apply link and start AI screening.</p>
            <Link to="/hr/jobs/new" className="btn btn-dark-pill">Create Requisition</Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Requisition ID</th>
                  <th>Job Title</th>
                  <th>Requested By</th>
                  <th>Status</th>
                  <th>Applicants</th>
                  <th>Requested On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id}>
                    <td className="mono">{requisitionCode(j.id)}</td>
                    <td>
                      <Link to={`/dashboard/${j.id}`} className="hr-table-title">{j.title}</Link>
                      <div className="hr-muted sm">Posted {timeAgo(j.created_at)}</div>
                    </td>
                    <td>
                      <span className="hr-person">
                        <span className="hr-avatar sm">{initials(userName)}</span>
                        {userName}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${(j.status ?? "open") === "open" ? "badge-green" : "badge-yellow"}`}>
                        {(j.status ?? "open") === "open" ? "Approved" : STATUS_CAP(j.status)}
                      </span>
                    </td>
                    <td>{j.applicant_count ?? 0}</td>
                    <td>{formatDate(j.created_at)}</td>
                    <td className="hr-row-actions">
                      <button type="button" className="hr-icon-btn" onClick={() => setMenuId(menuId === j.id ? null : j.id)} aria-label="Row actions">
                        <MoreHorizontal size={16} />
                      </button>
                      {menuId === j.id && (
                        <div className="hr-menu">
                          <button type="button" onClick={() => { copyLink(j.id); setMenuId(null); }}>
                            {copiedId === j.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy apply link</>}
                          </button>
                          <button type="button" onClick={() => navigate(`/dashboard/${j.id}`)}>
                            <ArrowRight size={14} /> View leaderboard
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => { setDeleteTarget(j); setConfirmTitle(""); setMenuId(null); }}
                          >
                            <Trash2 size={14} /> Delete job
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="hr-modal-backdrop">
          <div className="card hr-modal">
            <h2>Permanently delete job role?</h2>
            <p>
              You are about to delete <strong>{deleteTarget.title}</strong>. Candidate submissions, scores, and applications for this job will be removed.
            </p>
            <p>Type <strong>{deleteTarget.title}</strong> to confirm:</p>
            <input className="form-input" value={confirmTitle} onChange={(e) => setConfirmTitle(e.target.value)} autoFocus />
            <div className="hr-modal-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-sm hr-danger-btn"
                disabled={confirmTitle.trim().toLowerCase() !== deleteTarget.title.trim().toLowerCase() || deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? "Deleting..." : "Permanently Delete Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function STATUS_CAP(status?: string) {
  if (!status) return "Open";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
