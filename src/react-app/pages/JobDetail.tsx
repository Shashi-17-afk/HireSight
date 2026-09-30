import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, Users } from "lucide-react";
import Seo from "../components/Seo";
import { timeAgo } from "../lib/hr";

interface JobFull {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
  user_id?: string | null;
  applicant_count: number;
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

function DescriptionRenderer({ text, title }: { text: string; title: string }) {
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
            <div key={pi}>
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

export default function JobDetail() {
  const { job_id } = useParams<{ job_id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<JobFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const isCandidate = !!token && role === "candidate";

  useEffect(() => {
    if (!job_id) return;
    fetch(`/api/jobs/${job_id}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as JobFull & { error?: string };
        if (d.error) setError(d.error);
        else setJob(d);
      })
      .catch(() => setError("Could not load job details. Please try again."))
      .finally(() => setLoading(false));
  }, [job_id]);

  async function handleApply() {
    if (!isCandidate) {
      navigate(`/login/candidate?redirect=/apply/${job_id}`);
      return;
    }
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { profile?: { is_complete: boolean } | null };
      if (!data.profile?.is_complete) {
        navigate(`/candidate/profile?redirect=/apply/${job_id}`);
        return;
      }
    } catch {
      /* apply page handles errors */
    }
    navigate(`/apply/${job_id}`);
  }

  if (loading) {
    return (
      <div className="page hr-page">
        <div className="hr-empty-block">Loading job details…</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="page hr-page">
        <div className="hr-panel" style={{ textAlign: "center" }}>
          <p>{error || "Job not found"}</p>
          <Link to="/jobs" className="btn btn-secondary" style={{ marginTop: "1rem" }}>
            Back to openings
          </Link>
        </div>
      </div>
    );
  }

  const seoDesc =
    job.description.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, 155) + (job.description.length > 155 ? "…" : "");

  return (
    <div className="page hr-page">
      <Seo
        title={job.title}
        description={seoDesc}
        url={`https://hiresight.shashishanthan2706.workers.dev/jobs/${job_id}`}
      />

      <Link to="/jobs" className="hr-back">
        <ArrowLeft size={14} /> All openings
      </Link>

      <div className="hr-profile-hero">
        <div>
          <h1>{job.title}</h1>
          <p>Instant AI resume screening · Private match score</p>
        </div>
        <div className="hr-profile-actions">
          <button type="button" className="btn btn-dark-pill" onClick={() => void handleApply()}>
            {isCandidate ? "Apply for this role" : "Sign in to apply"}
          </button>
        </div>
      </div>

      <div className="hr-profile-grid">
        <div className="hr-panel">
          <div className="hr-panel-head">
            <h3>About this role</h3>
          </div>
          <DescriptionRenderer text={job.description} title={job.title} />
        </div>

        <div className="hr-stack">
          <div className="hr-panel">
            <div className="hr-panel-head">
              <h3>Role snapshot</h3>
            </div>
            <dl className="hr-dl" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <dt>Posted</dt>
                <dd>
                  <Clock3 size={14} style={{ marginRight: "0.35rem", verticalAlign: "middle" }} />
                  {timeAgo(job.created_at)}
                </dd>
              </div>
              <div>
                <dt>Applicants</dt>
                <dd>
                  <Users size={14} style={{ marginRight: "0.35rem", verticalAlign: "middle" }} />
                  {job.applicant_count} {job.applicant_count === 1 ? "candidate" : "candidates"}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="badge badge-green">Actively hiring</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="hr-panel">
            <div className="hr-panel-head">
              <h3>Apply</h3>
            </div>
            <p className="hr-muted" style={{ marginBottom: "1rem" }}>
              {isCandidate
                ? "Upload your resume next. Workers AI scores your fit against this description in seconds."
                : "Create a free candidate account to apply. Scoring is private to you."}
            </p>
            <button type="button" className="btn btn-dark-pill" style={{ width: "100%" }} onClick={() => void handleApply()}>
              {isCandidate ? "Continue to application" : "Sign in to apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
