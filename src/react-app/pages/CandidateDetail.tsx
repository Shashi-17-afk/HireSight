import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Link2, Mail, FileText, Send, Phone } from "lucide-react";
import Seo from "../components/Seo";
import { authHeaders, formatDate, initials, scoreClass, STATUS_LABEL } from "../lib/hr";

interface CandidateData {
  application_id: string | null;
  candidate_name: string;
  candidate_email: string;
  ai_score: number;
  ai_reasoning: string;
  status: string | null;
  job_id: string;
  job_title: string;
  applied_at: string;
  isAnonymous: boolean;
  phone: string | null;
  headline: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  resume_url: string | null;
}

const PIPELINE: string[] = ["applied", "under_review", "shortlisted", "interview", "hired"];
const REJECTED = "rejected";
const ALL_STATUSES = [...PIPELINE, REJECTED];
const TABS = ["Profile", "Documents", "Interviews", "Communication", "Offer"] as const;

export default function CandidateDetail() {
  const { submission_id } = useParams<{ submission_id: string }>();
  const [searchParams] = useSearchParams();
  const job_id = searchParams.get("job_id") ?? "";
  const navigate = useNavigate();

  const [data, setData] = useState<CandidateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rescreening, setRescreening] = useState(false);
  const [rescreenMsg, setRescreenMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");

  const token = localStorage.getItem("token") ?? "";

  useEffect(() => {
    if (!submission_id || !job_id) {
      setLoading(false);
      return;
    }

    fetch(`/api/applications/${submission_id}?job_id=${job_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: unknown) => {
        const raw = d as CandidateData & { error?: string };
        if (raw.error) {
          setLoadError(raw.error);
          return;
        }
        setData(raw);
        setSelectedStatus(raw.status ?? "applied");
      })
      .catch(() => setLoadError("Failed to load candidate data."))
      .finally(() => setLoading(false));
  }, [submission_id, job_id, token]);

  async function handleStatusUpdate(nextStatus = selectedStatus) {
    if (!data?.application_id || !nextStatus) return;
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await fetch(`/api/applications/${data.application_id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json()) as { status?: string; changed?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setSelectedStatus(json.status ?? nextStatus);
      setData((prev) => (prev ? { ...prev, status: json.status ?? nextStatus } : prev));
      setUpdateMsg({
        ok: true,
        text: json.changed ? `Status updated to "${STATUS_LABEL[nextStatus] ?? nextStatus}"` : "Status unchanged.",
      });
    } catch (err) {
      setUpdateMsg({ ok: false, text: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setUpdating(false);
    }
  }

  async function handleRescreen() {
    if (!submission_id || !job_id) return;
    setRescreening(true);
    setRescreenMsg(null);
    try {
      const res = await fetch(`/api/applications/${submission_id}/rescreen?job_id=${job_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const json = (await res.json()) as { success?: boolean; score?: number; reasoning?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Rescreen failed");

      setData((prev) =>
        prev
          ? {
              ...prev,
              ai_score: json.score ?? prev.ai_score,
              ai_reasoning: json.reasoning ?? prev.ai_reasoning,
            }
          : prev
      );
      setRescreenMsg({ ok: true, text: "AI screening updated successfully." });
    } catch (err) {
      setRescreenMsg({ ok: false, text: err instanceof Error ? err.message : "Rescreen failed." });
    } finally {
      setRescreening(false);
    }
  }

  if (loading) {
    return <div className="hr-empty-block">Loading candidate…</div>;
  }

  if (loadError || !data) {
    return (
      <div className="hr-page">
        <div className="hr-panel" style={{ textAlign: "center" }}>
          <p>{loadError || "Candidate not found."}</p>
          <button className="btn btn-secondary" style={{ marginTop: "1rem" }} onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = data.status ?? "applied";
  const skills = (data.headline || "")
    .split(/[·|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div className="hr-page">
      <Seo title={`${data.candidate_name} · Candidate`} noIndex />
      <Link to="/hr/candidates" className="hr-back">
        <ArrowLeft size={14} /> Back to Candidates
      </Link>

      <div className="hr-profile-hero">
        <span className="hr-avatar xl">{initials(data.candidate_name)}</span>
        <div>
          <h1>
            {data.candidate_name}{" "}
            <span className={`badge ${currentStatus === "rejected" ? "badge-red" : "badge-green"}`}>
              {currentStatus === "rejected" ? "Inactive" : "Active"}
            </span>
          </h1>
          <p>{data.job_title || data.headline || "Applicant"}</p>
        </div>
        <div className="hr-profile-actions">
          <a className="btn btn-secondary btn-sm" href={`mailto:${data.candidate_email}`}>
            <Mail size={14} /> Compose Email
          </a>
          {data.resume_url ? (
            <a className="btn btn-secondary btn-sm" href={data.resume_url} target="_blank" rel="noreferrer">
              <FileText size={14} /> Documents
            </a>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" disabled>
              <FileText size={14} /> Documents
            </button>
          )}
          <button
            type="button"
            className="btn btn-dark-pill btn-sm"
            disabled={data.isAnonymous || !data.application_id || updating || currentStatus === "hired"}
            onClick={() => void handleStatusUpdate("hired")}
          >
            <Send size={14} /> {currentStatus === "hired" ? "Hired" : "Send Offer"}
          </button>
        </div>
      </div>

      <div className="hr-tabs">
        {TABS.map((item) => (
          <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      {data.isAnonymous && (
        <div className="profile-banner">
          <span className="profile-banner-icon">
            <Link2 size={22} />
          </span>
          <div>
            <strong>External link application</strong>
            <p>This candidate applied via the public shareable link without an account. Status tracking is not available.</p>
          </div>
        </div>
      )}

      {tab === "Profile" && (
        <div className="hr-profile-grid">
          <div className="hr-stack">
            <div className="hr-panel">
              <div className="hr-panel-head">
                <h3>Candidate information</h3>
              </div>
              <dl className="hr-dl">
                <div>
                  <dt>Position</dt>
                  <dd>{data.job_title || "—"}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{STATUS_LABEL[currentStatus] ?? currentStatus}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{data.candidate_email}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{data.phone || "—"}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{data.isAnonymous ? "Apply Link" : "Application Form"}</dd>
                </div>
                <div>
                  <dt>Applied on</dt>
                  <dd>{formatDate(data.applied_at)}</dd>
                </div>
              </dl>
              {(data.linkedin_url || data.github_url || data.portfolio_url || data.phone) && (
                <div className="hr-inline-actions" style={{ marginTop: "1rem" }}>
                  {data.phone && (
                    <a className="btn btn-secondary btn-sm" href={`tel:${data.phone}`}>
                      <Phone size={14} /> {data.phone}
                    </a>
                  )}
                  {data.linkedin_url && (
                    <a className="btn btn-secondary btn-sm" href={data.linkedin_url} target="_blank" rel="noreferrer">
                      LinkedIn
                    </a>
                  )}
                  {data.github_url && (
                    <a className="btn btn-secondary btn-sm" href={data.github_url} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  )}
                  {data.portfolio_url && (
                    <a className="btn btn-secondary btn-sm" href={data.portfolio_url} target="_blank" rel="noreferrer">
                      Portfolio
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="hr-panel">
              <div className="hr-panel-head">
                <h3>Interview History</h3>
                <Link to={`/dashboard/${job_id}`} className="hr-text-link">
                  Open leaderboard
                </Link>
              </div>
              {currentStatus === "interview" || currentStatus === "hired" ? (
                <div className="hr-history-row">
                  <span>{formatDate(data.applied_at)}</span>
                  <span>Pipeline</span>
                  <span>Recruiter</span>
                  <span className="badge badge-yellow">{STATUS_LABEL[currentStatus]}</span>
                </div>
              ) : (
                <div className="hr-empty-inline">No interviews logged yet. Move this candidate to Interview to start tracking.</div>
              )}
            </div>

            {!data.isAnonymous && data.application_id && (
              <div className="hr-panel">
                <div className="hr-panel-head">
                  <h3>Application Status</h3>
                </div>
                <div className="hr-status-pills">
                  {PIPELINE.map((s) => (
                    <span key={s} className={`badge ${currentStatus === s ? "badge-green" : "badge-blue"}`}>
                      {STATUS_LABEL[s]}
                    </span>
                  ))}
                </div>
                <div className="hr-inline-actions" style={{ marginTop: "1rem" }}>
                  <select
                    className="form-input hr-select"
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setUpdateMsg(null);
                    }}
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-dark-pill btn-sm"
                    onClick={() => void handleStatusUpdate()}
                    disabled={updating || selectedStatus === currentStatus}
                  >
                    {updating ? "Saving…" : "Update Status"}
                  </button>
                </div>
                {updateMsg && (
                  <p className={updateMsg.ok ? "delta-up" : "delta-down"} style={{ marginTop: "0.75rem" }}>
                    {updateMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="hr-panel hr-score-card">
            <div className="hr-panel-head">
              <h3>AI Screening</h3>
            </div>
            <div className={`hr-score-big ${scoreClass(data.ai_score)}`}>{data.ai_score}%</div>
            <p>Match Score</p>
            <span className={`badge ${(data.ai_score ?? 0) >= 80 ? "badge-green" : "badge-yellow"}`}>
              {(data.ai_score ?? 0) >= 80 ? "Auto-Shortlist" : "Needs Review"}
            </span>
            <h4>Summary</h4>
            <p className="hr-score-copy">{data.ai_reasoning}</p>
            {skills.length > 0 && (
              <>
                <h4>Signals</h4>
                <div className="hr-chips">
                  {skills.map((s) => (
                    <span key={s} className="hr-chip static">
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={rescreening}
              onClick={() => void handleRescreen()}
            >
              {rescreening ? "Re-running AI…" : "Re-run AI Screening"}
            </button>
            {rescreenMsg && (
              <p className={rescreenMsg.ok ? "delta-up" : "delta-down"} style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                {rescreenMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "Documents" && (
        <div className="hr-panel">
          {data.resume_url ? (
            <a href={data.resume_url} target="_blank" rel="noreferrer" className="btn btn-dark-pill">
              Open resume
            </a>
          ) : (
            <div className="hr-empty-inline">No hosted resume file is attached. The original resume text was scored at apply time.</div>
          )}
        </div>
      )}

      {tab === "Interviews" && (
        <div className="hr-panel">
          <div className="hr-empty-inline">
            HireSight tracks interview stage in the pipeline. Use Update Status on Profile to move this candidate to Interview.
          </div>
        </div>
      )}

      {tab === "Communication" && (
        <div className="hr-panel">
          <a className="btn btn-dark-pill" href={`mailto:${data.candidate_email}`}>
            Email {data.candidate_email}
          </a>
        </div>
      )}

      {tab === "Offer" && (
        <div className="hr-panel">
          <p className="hr-muted" style={{ marginBottom: "1rem" }}>
            Sending an offer marks this candidate as Hired in the pipeline and emails them if they applied with an account.
          </p>
          <button
            type="button"
            className="btn btn-dark-pill"
            disabled={data.isAnonymous || !data.application_id || updating || currentStatus === "hired"}
            onClick={() => void handleStatusUpdate("hired")}
          >
            {currentStatus === "hired" ? "Already hired" : "Send Offer / Mark Hired"}
          </button>
        </div>
      )}
    </div>
  );
}
