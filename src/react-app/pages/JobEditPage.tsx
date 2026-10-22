import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Eye,
  Edit3,
  ExternalLink,
  Users,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import Seo from "../components/Seo";
import { authHeaders, requisitionCode } from "../lib/hr";

interface JobData {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  applicant_count?: number;
}

const JD_HEADINGS = /^(Role Summary|Key Responsibilities|Requirements|Preferred Qualifications)$/i;

function tidyLine(line: string) {
  return line.replace(/\*\*/g, "").replace(/^#{1,6}\s+/, "").trim();
}

function isHeadingLine(line: string) {
  if (JD_HEADINGS.test(line)) return true;
  if (line.length < 72 && /:$/.test(line) && !/^[-*•]/.test(line)) return true;
  return false;
}

function PreviewRenderer({ text, title }: { text: string; title: string }) {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className="job-detail-description">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n").map((l) => tidyLine(l)).filter(Boolean);
        if (lines.length === 0) return null;
        if (pi === 0 && lines.length === 1 && lines[0].toLowerCase() === title.toLowerCase()) {
          return null;
        }

        const isList = lines.every((l) => /^[-*•]/.test(l));
        if (isList) {
          return (
            <ul key={pi} className="job-detail-list">
              {lines.map((l, li) => (
                <li key={li}>{l.replace(/^[-*•]\s*/, "")}</li>
              ))}
            </ul>
          );
        }

        if (isHeadingLine(lines[0])) {
          const rest = lines.slice(1);
          const restIsList = rest.length > 0 && rest.every((l) => /^[-*•]/.test(l));
          return (
            <div key={pi} style={{ marginBottom: "1.25rem" }}>
              <h3 className="job-detail-h">{lines[0].replace(/:$/, "")}</h3>
              {restIsList ? (
                <ul className="job-detail-list">
                  {rest.map((l, li) => (
                    <li key={li}>{l.replace(/^[-*•]\s*/, "")}</li>
                  ))}
                </ul>
              ) : rest.length > 0 ? (
                <p className="job-detail-para">{rest.join(" ")}</p>
              ) : null}
            </div>
          );
        }

        return (
          <p key={pi} className="job-detail-para">
            {lines.map((l, li) => (
              <span key={li}>
                {l}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function JobEditPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<JobData | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");

  useEffect(() => {
    if (!job_id) return;
    setLoading(true);
    setError("");

    fetch(`/api/jobs/${job_id}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as JobData & { error?: string };
        if (d.error) {
          setError(d.error);
        } else {
          setJob(d);
          setTitle(d.title || "");
          setDescription(d.description || "");
          setStatus((d.status === "closed" ? "closed" : "open") as "open" | "closed");
        }
      })
      .catch(() => setError("Failed to load job details"))
      .finally(() => setLoading(false));
  }, [job_id]);

  async function handleSave() {
    if (!job_id || saving) return;
    if (!title.trim()) {
      setError("Job title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Job description is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/jobs/${job_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status,
        }),
      });

      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update job");

      setToast("Job requisition updated successfully!");
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnhanceWithAi() {
    if (!description.trim() || enhancing) return;
    setEnhancing(true);
    setError("");

    try {
      const res = await fetch("/api/jobs/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          description: description.trim(),
          instructions: aiInstructions.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { enhancedDescription?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "AI enhancement failed");

      if (data.enhancedDescription) {
        setDescription(data.enhancedDescription);
        setShowAiModal(false);
        setAiInstructions("");
        setToast("Job description polished and enhanced with AI!");
        setTimeout(() => setToast(null), 3500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }

  function insertFormatting(prefix: string, suffix: string = "") {
    const textarea = document.getElementById("job-desc-textarea") as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = description.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;

    const newText = description.substring(0, start) + replacement + description.substring(end);
    setDescription(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 50);
  }

  if (loading) {
    return (
      <div className="hr-page">
        <div className="hr-empty-block">Loading requisition editor…</div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="hr-page">
        <div className="hr-banner-error" style={{ textAlign: "center", padding: "2rem" }}>
          <p>{error || "Job requisition not found"}</p>
          <Link to="/hr/jobs" className="btn btn-secondary" style={{ marginTop: "1rem" }}>
            Back to Job Requisitions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-page">
      <Seo title={`Edit Job: ${title || "Requisition"}`} description="Edit job title, description, and status." noIndex />

      <Link to="/hr/jobs" className="hr-back">
        <ArrowLeft size={14} /> Back to Job Requisitions
      </Link>

      {/* Page Header */}
      <div className="hr-page-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
            <span className="mono badge badge-gray" style={{ fontSize: "0.75rem" }}>
              {requisitionCode(job_id ?? "")}
            </span>
            <span className={`badge ${status === "open" ? "badge-green" : "badge-yellow"}`}>
              {status === "open" ? "Open & Accepting" : "Closed"}
            </span>
          </div>
          <h1>Edit Job Requisition</h1>
          <p>Update posting details, calibrate requirements, or modify active application status.</p>
        </div>

        <div className="hr-page-actions" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link to={`/dashboard/${job_id}`} className="btn btn-secondary">
            <Users size={15} /> Leaderboard
          </Link>
          <a
            href={`/jobs/${job_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            title="Preview how candidates see this job"
          >
            <ExternalLink size={15} /> Candidate View
          </a>
          <button
            type="button"
            className="btn btn-dark-pill"
            disabled={saving || !title.trim() || !description.trim()}
            onClick={() => void handleSave()}
          >
            <Save size={15} /> {saving ? "Saving Changes…" : "Save Changes"}
          </button>
        </div>
      </div>

      {toast && <div className="hr-toast"><Check size={16} /> {toast}</div>}
      {error && <div className="hr-banner-error"><AlertCircle size={16} /> {error}</div>}

      <div className="hr-jd-grid" style={{ gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        {/* Core Job Meta Card */}
        <div className="hr-panel">
          <div className="hr-panel-head">
            <Edit3 size={18} style={{ color: "var(--brand-primary)" }} />
            <div>
              <h3>Role Overview & Status</h3>
              <p>Configure the job title and recruitment lifecycle status.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "1rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label" htmlFor="edit-job-title" style={{ fontWeight: 600 }}>
                Job Title <span style={{ color: "var(--status-red)" }}>*</span>
              </label>
              <input
                id="edit-job-title"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Distributed Systems Engineer"
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="label" style={{ fontWeight: 600 }}>
                Recruitment Status
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${status === "open" ? "btn-dark-pill" : "btn-secondary"}`}
                  onClick={() => setStatus("open")}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginRight: 6 }} />
                  Open (Accepting)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${status === "closed" ? "btn-dark-pill" : "btn-secondary"}`}
                  onClick={() => setStatus("closed")}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#eab308", display: "inline-block", marginRight: 6 }} />
                  Closed (Archived)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Job Description Editor Card */}
        <div className="hr-panel">
          <div className="hr-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h3>Job Description & Screening Criteria</h3>
              <p>The AI screener evaluates candidates against this description to produce match scores.</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAiModal(true)}
                title="Polish description with Workers AI"
              >
                <Sparkles size={14} style={{ color: "#ec4899" }} /> AI Polish & Enhance
              </button>

              <div style={{ display: "inline-flex", background: "var(--bg-subtle, #f4f4f5)", borderRadius: "8px", padding: "2px" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === "editor" ? "btn-dark-pill" : "btn-ghost"}`}
                  onClick={() => setActiveTab("editor")}
                  style={{ fontSize: "0.8rem", padding: "4px 10px", height: "auto" }}
                >
                  <Edit3 size={13} style={{ marginRight: 4 }} /> Edit
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === "preview" ? "btn-dark-pill" : "btn-ghost"}`}
                  onClick={() => setActiveTab("preview")}
                  style={{ fontSize: "0.8rem", padding: "4px 10px", height: "auto" }}
                >
                  <Eye size={13} style={{ marginRight: 4 }} /> Candidate Preview
                </button>
              </div>
            </div>
          </div>

          {activeTab === "editor" ? (
            <div style={{ marginTop: "1rem" }}>
              {/* Quick Markdown Toolbar */}
              <div
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  padding: "0.4rem 0.6rem",
                  background: "var(--bg-card, #fafafa)",
                  border: "1px solid var(--border)",
                  borderBottom: "none",
                  borderTopLeftRadius: "8px",
                  borderTopRightRadius: "8px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => insertFormatting("### ")}
                  style={{ fontSize: "0.75rem", padding: "2px 8px", height: "26px" }}
                >
                  H3 Section
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => insertFormatting("**", "**")}
                  style={{ fontSize: "0.75rem", padding: "2px 8px", height: "26px", fontWeight: "bold" }}
                >
                  Bold
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => insertFormatting("- ")}
                  style={{ fontSize: "0.75rem", padding: "2px 8px", height: "26px" }}
                >
                  • Bullet
                </button>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                  <HelpCircle size={13} /> Markdown supported
                </span>
              </div>

              <textarea
                id="job-desc-textarea"
                className="form-input"
                rows={18}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter role summary, responsibilities, requirements..."
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  lineHeight: "1.6",
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  width: "100%",
                  resize: "vertical",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                marginTop: "1rem",
                padding: "1.5rem",
                background: "var(--bg-card, #ffffff)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                minHeight: "360px",
              }}
            >
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1rem" }}>{title || "Untitled Role"}</h2>
              {description.trim() ? (
                <PreviewRenderer text={description} title={title} />
              ) : (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No description text entered yet.</p>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {description.length} characters · Saving will automatically re-index semantic AI match embeddings.
            </span>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/hr/jobs")}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-dark-pill"
                disabled={saving || !title.trim() || !description.trim()}
                onClick={() => void handleSave()}
              >
                <Save size={15} /> {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Polish Modal */}
      {showAiModal && (
        <div className="hr-modal-backdrop">
          <div className="card hr-modal" style={{ maxWidth: "540px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span className="badge badge-pink" style={{ padding: "4px 8px" }}>
                <Sparkles size={13} /> Cloudflare Workers AI
              </span>
            </div>
            <h2>Polish Job Description</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Workers AI (@cf/meta/llama-3.1-8b) will review your job description to improve clarity, executive tone, inclusive language, and clean markdown structure while strictly preserving all your factual expectations.
            </p>

            <div className="form-group">
              <label className="label" htmlFor="ai-instructions">
                Specific Instructions (Optional)
              </label>
              <input
                id="ai-instructions"
                className="form-input"
                placeholder="e.g. Focus on distributed systems, make bullets punchier, emphasize AWS/GCP"
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
              />
            </div>

            <div className="hr-modal-actions" style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={enhancing}
                onClick={() => setShowAiModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-dark-pill"
                disabled={enhancing || !description.trim()}
                onClick={() => void handleEnhanceWithAi()}
              >
                <Sparkles size={14} /> {enhancing ? "Enhancing with AI…" : "Polish Description"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
