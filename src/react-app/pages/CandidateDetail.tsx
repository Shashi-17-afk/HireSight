import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Link2,
  Mail,
  FileText,
  Send,
  Phone,
  CheckCircle,
  Calendar,
  Clock,
  Video,
  Star,
  Plus,
  AlertCircle,
  X,
  ExternalLink,
  Sparkles,
  Download,
  Briefcase,
  DollarSign,
  Award,
  Check,
  Building,
  Printer,
  Eye,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Seo from "../components/Seo";
import { authHeaders, formatDate, initials, scoreClass, STATUS_LABEL } from "../lib/hr";

interface RecommendedQuestion {
  topic: string;
  question: string;
  targetSignal: string;
}

interface CvAnalysisData {
  matchScore: number;
  verdict: string;
  summary: string;
  seniority: {
    estimatedYears: number;
    level: string;
    alignmentWithRole: string;
  };
  skillsAnalysis: {
    matchedSkills: string[];
    missingSkills: string[];
    bonusSkills: string[];
  };
  strengths: string[];
  concernsOrGaps: string[];
  recommendedInterviewQuestions: RecommendedQuestion[];
  atsScores: {
    technicalFit: number;
    experienceRelevance: number;
    educationAndDomain: number;
    impactAndClarity: number;
  };
}

interface InterviewItem {
  id: string;
  application_id: string;
  job_id: string;
  hr_id: string;
  candidate_id: string;
  scheduled_at: string;
  duration_minutes: number;
  round_type: string;
  meeting_link: string | null;
  notes: string | null;
  status: string;
  feedback: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

const ROUND_PRESETS = [
  "Initial Screening",
  "Technical Round 1",
  "Technical Round 2",
  "System Design",
  "Cultural Fit",
  "Hiring Manager",
  "Final Round",
];
const DURATION_OPTIONS = [15, 30, 45, 60, 90];

interface CandidateData {
  application_id: string | null;
  candidate_submission_id?: string;
  user_id?: string | null;
  candidate_name: string;
  candidate_email: string;
  ai_score: number;
  ai_reasoning: string;
  resume_text?: string | null;
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
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  const [rescoring, setRescoring] = useState(false);
  const [rescoreMsg, setRescoreMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Messaging state ──
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgResult, setMsgResult] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Interview scheduling state ──
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [roundType, setRoundType] = useState("Technical Round 1");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [meetingLink, setMeetingLink] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");

  // Feedback State
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);

  // ── AI CV Analysis state ──
  const [cvAnalysis, setCvAnalysis] = useState<CvAnalysisData | null>(null);
  const [loadingCvAnalysis, setLoadingCvAnalysis] = useState(false);
  const [cvAnalysisError, setCvAnalysisError] = useState("");
  const [showRawResume, setShowRawResume] = useState(false);
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState<number | null>(null);

  const handleRunCvAnalysis = useCallback(async () => {
    if (!submission_id) return;
    setLoadingCvAnalysis(true);
    setCvAnalysisError("");
    try {
      const res = await fetch(`/api/applications/${submission_id}/cv-analysis`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = (await res.json()) as {
        success?: boolean;
        analysis?: CvAnalysisData;
        resumeText?: string;
        error?: string;
      };
      if (!res.ok || !json.analysis) {
        throw new Error(json.error ?? "Failed to perform AI CV analysis");
      }
      setCvAnalysis(json.analysis);
      if (json.resumeText) {
        setData((prev) => (prev ? { ...prev, resume_text: json.resumeText } : prev));
      }
    } catch (err) {
      setCvAnalysisError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoadingCvAnalysis(false);
    }
  }, [submission_id]);

  // ── Offer Studio state ──
  const [offerSalary, setOfferSalary] = useState("$130,000 / year");
  const [offerStartDate, setOfferStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [offerEmploymentType, setOfferEmploymentType] = useState("Full-Time");
  const [offerWorkLocation, setOfferWorkLocation] = useState("Remote");
  const [offerReportingManager, setOfferReportingManager] = useState("Engineering Director");
  const [offerExpiryDate, setOfferExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [offerBenefitsSummary, setOfferBenefitsSummary] = useState(
    "Comprehensive Medical, Dental & Vision insurance; 401(k) retirement plan with 4% company match; Unlimited Flexible Paid Time Off (PTO); $1,500 annual equipment & learning stipend."
  );
  const [offerCustomNotes, setOfferCustomNotes] = useState(
    "We were thoroughly impressed by your performance throughout our interview process and are excited about the skills and energy you will bring to the team."
  );
  const [offerCompanyName, setOfferCompanyName] = useState("HireSight Technologies");
  const [offerSending, setOfferSending] = useState(false);
  const [offerDownloading, setOfferDownloading] = useState(false);
  const [offerResult, setOfferResult] = useState<{
    ok: boolean;
    text: string;
    pdfBase64?: string;
    pdfFilename?: string;
  } | null>(null);
  const [offerTabMode, setOfferTabMode] = useState<"form" | "preview">("form");

  function downloadBase64Pdf(base64Data: string, filename: string) {
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadOfferPreview() {
    if (!data?.application_id) return;
    setOfferDownloading(true);
    try {
      const res = await fetch(`/api/applications/${data.application_id}/offer/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          salary: offerSalary,
          startDate: offerStartDate,
          employmentType: offerEmploymentType,
          workLocation: offerWorkLocation,
          reportingManager: offerReportingManager,
          expiryDate: offerExpiryDate,
          benefitsSummary: offerBenefitsSummary,
          customNotes: offerCustomNotes,
          companyName: offerCompanyName,
        }),
      });
      const json = (await res.json()) as { pdfBase64?: string; pdfFilename?: string; error?: string };
      if (!res.ok || !json.pdfBase64) throw new Error(json.error ?? "Failed to generate PDF preview");
      downloadBase64Pdf(json.pdfBase64, json.pdfFilename || `Offer_Letter_${data.candidate_name}.pdf`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error downloading offer PDF");
    } finally {
      setOfferDownloading(false);
    }
  }

  async function handleSendOfficialOffer() {
    if (!data?.application_id) return;
    if (!offerSalary.trim()) {
      alert("Please provide a salary / compensation amount.");
      return;
    }
    if (!offerStartDate.trim()) {
      alert("Please select an anticipated start date.");
      return;
    }

    setOfferSending(true);
    setOfferResult(null);

    try {
      const res = await fetch(`/api/applications/${data.application_id}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          salary: offerSalary.trim(),
          startDate: offerStartDate.trim(),
          employmentType: offerEmploymentType.trim(),
          workLocation: offerWorkLocation.trim(),
          reportingManager: offerReportingManager.trim(),
          expiryDate: offerExpiryDate.trim(),
          benefitsSummary: offerBenefitsSummary.trim(),
          customNotes: offerCustomNotes.trim(),
          companyName: offerCompanyName.trim(),
        }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        status?: string;
        emailSent?: boolean;
        pdfFilename?: string;
        pdfBase64?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(json.error ?? "Failed to send offer");

      setSelectedStatus("hired");
      setData((prev) => (prev ? { ...prev, status: "hired" } : prev));
      setOfferResult({
        ok: true,
        text: json.message ?? "Official Offer Letter PDF generated and dispatched successfully!",
        pdfBase64: json.pdfBase64,
        pdfFilename: json.pdfFilename,
      });
    } catch (err) {
      setOfferResult({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to send offer letter.",
      });
    } finally {
      setOfferSending(false);
    }
  }

  const token = localStorage.getItem("token") ?? "";

  const loadInterviews = useCallback(async (appId: string) => {
    setLoadingInterviews(true);
    try {
      const res = await fetch(`/api/interviews/application/${appId}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = (await res.json()) as InterviewItem[];
        setInterviews(json);
      }
    } catch {
      // ignore
    } finally {
      setLoadingInterviews(false);
    }
  }, []);

  function generateMeetingLink() {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const randPart = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const link = `https://meet.google.com/${randPart(3)}-${randPart(4)}-${randPart(3)}`;
    setMeetingLink(link);
  }

  function formatInterviewDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function getInterviewRelative(iso: string) {
    const now = Date.now();
    const target = new Date(iso).getTime();
    const diff = target - now;
    if (diff < -3600000 * 2) return "Passed";
    if (diff < 0) return "Happening now";
    const hours = Math.round(diff / 3600000);
    if (hours < 24) return `In ${hours} hr${hours === 1 ? "" : "s"}`;
    const days = Math.round(diff / 86400000);
    return `In ${days} day${days === 1 ? "" : "s"}`;
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.application_id || !schedDate || !schedTime) {
      setScheduleError("Please select both a date and time.");
      return;
    }
    setScheduling(true);
    setScheduleError("");
    setScheduleSuccess("");
    try {
      const scheduledAt = new Date(`${schedDate}T${schedTime}:00`).toISOString();
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          application_id: data.application_id,
          job_id: data.job_id,
          round_type: roundType,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          meeting_link: meetingLink.trim() || undefined,
          notes: interviewNotes.trim() || undefined,
          candidate_email: data.candidate_email || undefined,
          candidate_name: data.candidate_name || undefined,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        email_sent?: boolean;
        candidate_email?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to schedule interview");

      const recipient = json.candidate_email || data.candidate_email;
      setScheduleSuccess(
        recipient
          ? `Interview scheduled! Invitation email sent to ${recipient}.`
          : "Interview scheduled successfully! Candidate has been notified."
      );
      setSelectedStatus("interview");
      setData((prev) => (prev ? { ...prev, status: "interview" } : prev));
      if (data.application_id) {
        await loadInterviews(data.application_id);
      }
      setTimeout(() => {
        setShowScheduleModal(false);
        setScheduleSuccess("");
      }, 1600);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Scheduling failed");
    } finally {
      setScheduling(false);
    }
  }

  async function handleUpdateInterviewStatus(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setInterviews((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating interview");
    }
  }

  async function handleSaveFeedback(id: string) {
    setSavingFeedback(true);
    try {
      const res = await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          status: "completed",
          feedback: feedbackText.trim() || null,
          rating: feedbackRating,
        }),
      });
      if (!res.ok) throw new Error("Failed to save feedback");
      setInterviews((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: "completed", feedback: feedbackText.trim() || null, rating: feedbackRating }
            : i
        )
      );
      setActiveFeedbackId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving feedback");
    } finally {
      setSavingFeedback(false);
    }
  }

  useEffect(() => {
    if (!submission_id) {
      setLoading(false);
      return;
    }

    const url = job_id
      ? `/api/applications/${submission_id}?job_id=${encodeURIComponent(job_id)}`
      : `/api/applications/${submission_id}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: unknown) => {
        const raw = d as CandidateData & {
          error?: string;
          name?: string;
          email?: string;
          score?: number;
          reasoning?: string;
        };
        if (raw.error) {
          setLoadError(raw.error);
          return;
        }
        const normalized: CandidateData = {
          ...raw,
          candidate_name: raw.candidate_name || raw.name || "Candidate",
          candidate_email: raw.candidate_email || raw.email || "",
          ai_score: raw.ai_score ?? raw.score ?? 0,
          ai_reasoning: raw.ai_reasoning || raw.reasoning || "",
          resume_text: (raw as { resume_text?: string }).resume_text || null,
        };
        setData(normalized);
        setSelectedStatus(normalized.status ?? "applied");
        if (normalized.application_id) {
          void loadInterviews(normalized.application_id);
        }
      })
      .catch(() => setLoadError("Failed to load candidate data."))
      .finally(() => setLoading(false));
  }, [submission_id, job_id, token, loadInterviews]);

  useEffect(() => {
    if (tab === "Documents" && !cvAnalysis && !loadingCvAnalysis && submission_id) {
      void handleRunCvAnalysis();
    }
  }, [tab, cvAnalysis, loadingCvAnalysis, submission_id, handleRunCvAnalysis]);

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

  async function handleRescore() {
    if (!submission_id) return;
    setRescoring(true);
    setRescoreMsg(null);
    try {
      const res = await fetch(`/api/applications/${submission_id}/rescore`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = (await res.json()) as {
        score?: number;
        reasoning?: string;
        previous_score?: number | null;
        error?: string;
      };
      if (!res.ok || typeof json.score !== "number") throw new Error(json.error ?? "Re-run failed");
      const newScore = json.score;
      setData((prev) => (prev ? { ...prev, ai_score: newScore, ai_reasoning: json.reasoning ?? prev.ai_reasoning } : prev));
      const prevScore = json.previous_score;
      setRescoreMsg({
        ok: true,
        text:
          typeof prevScore === "number" && prevScore !== newScore
            ? `Re-scored: ${prevScore}% → ${newScore}%`
            : `Re-scored: ${newScore}% (unchanged)`,
      });
    } catch (err) {
      setRescoreMsg({ ok: false, text: err instanceof Error ? err.message : "Re-run failed." });
    } finally {
      setRescoring(false);
    }
  }

  async function handleSendMessage() {
    if (!data || !msgSubject.trim() || !msgBody.trim()) return;

    setMsgSending(true);
    setMsgResult(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          application_id: data.application_id || undefined,
          to_user_id: data.user_id || undefined,
          candidate_submission_id: data.candidate_submission_id || submission_id || undefined,
          candidate_email: data.candidate_email || undefined,
          subject: msgSubject.trim(),
          body: msgBody.trim(),
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to send");
      setMsgResult({ ok: true, text: "Message sent! The candidate will see it in their inbox." });
      setMsgSubject("");
      setMsgBody("");
    } catch (err) {
      setMsgResult({ ok: false, text: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setMsgSending(false);
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
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setTab("Interviews");
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setSchedDate(tomorrow.toISOString().split("T")[0]);
              setShowScheduleModal(true);
            }}
          >
            <Calendar size={14} /> Schedule Interview
          </button>
          <button
            type="button"
            className="btn btn-dark-pill btn-sm"
            onClick={() => {
              setTab("Offer");
              const el = document.querySelector(".hr-tabs");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Send size={14} /> {currentStatus === "hired" ? "View Offer / Hired" : "Send Offer"}
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
                <button
                  type="button"
                  className="hr-text-link"
                  onClick={() => {
                    setTab("Interviews");
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setSchedDate(tomorrow.toISOString().split("T")[0]);
                    setShowScheduleModal(true);
                  }}
                >
                  + Schedule round
                </button>
              </div>
              {interviews.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {interviews.map((iv) => (
                    <div
                      key={iv.id}
                      className="hr-history-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => setTab("Interviews")}
                    >
                      <span>{formatDate(iv.scheduled_at)}</span>
                      <span style={{ fontWeight: 600 }}>{iv.round_type}</span>
                      <span>{iv.duration_minutes}m</span>
                      <span
                        className={`badge ${
                          iv.status === "completed"
                            ? "badge-green"
                            : iv.status === "cancelled"
                            ? "badge-red"
                            : "badge-blue"
                        }`}
                      >
                        {iv.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : currentStatus === "interview" || currentStatus === "hired" ? (
                <div className="hr-history-row">
                  <span>{formatDate(data.applied_at)}</span>
                  <span>Pipeline</span>
                  <span>Recruiter</span>
                  <span className="badge badge-yellow">{STATUS_LABEL[currentStatus]}</span>
                </div>
              ) : (
                <div className="hr-empty-inline">
                  No interviews scheduled yet.
                  <button
                    type="button"
                    className="hr-text-link"
                    style={{ marginLeft: 6 }}
                    onClick={() => {
                      setTab("Interviews");
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setSchedDate(tomorrow.toISOString().split("T")[0]);
                      setShowScheduleModal(true);
                    }}
                  >
                    Schedule an interview →
                  </button>
                </div>
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
              disabled={rescoring}
              onClick={() => void handleRescore()}
            >
              {rescoring ? "Re-scoring…" : "Re-run AI Screening"}
            </button>
            <button
              type="button"
              className="btn btn-dark-pill btn-sm"
              style={{ marginTop: "0.5rem", width: "100%", justifyContent: "center" }}
              onClick={() => {
                setTab("Documents");
                if (!cvAnalysis) void handleRunCvAnalysis();
              }}
            >
              <Sparkles size={14} /> View In-Depth CV Analysis
            </button>
            {rescoreMsg && (
              <p className={rescoreMsg.ok ? "delta-up" : "delta-down"} style={{ marginTop: "0.6rem", fontSize: "0.82rem" }}>
                {rescoreMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "Documents" && (
        <div className="cv-studio-wrap">
          {/* Header Action Bar */}
          <div className="cv-hero-card">
            <div className="cv-verdict-group">
              <div
                className={`cv-score-circle ${
                  (cvAnalysis?.matchScore ?? data.ai_score ?? 0) >= 80
                    ? ""
                    : (cvAnalysis?.matchScore ?? data.ai_score ?? 0) >= 60
                    ? "score-amber"
                    : "score-red"
                }`}
              >
                <span>{cvAnalysis ? `${cvAnalysis.matchScore}%` : `${data.ai_score}%`}</span>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase" }}>Match</span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                    AI CV Analysis & ATS Evaluation
                  </h3>
                  {cvAnalysis && (
                    <span className="badge badge-green" style={{ fontSize: "0.76rem" }}>
                      {cvAnalysis.verdict}
                    </span>
                  )}
                  {cvAnalysis?.seniority && (
                    <span className="badge badge-yellow" style={{ fontSize: "0.76rem" }}>
                      {cvAnalysis.seniority.level} ({cvAnalysis.seniority.estimatedYears}+ yrs)
                    </span>
                  )}
                </div>
                <p className="hr-muted" style={{ margin: "4px 0 0 0", fontSize: "0.85rem" }}>
                  {cvAnalysis?.summary || data.ai_reasoning || "Deep semantic CV analysis against job description."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-dark-pill btn-sm"
                disabled={loadingCvAnalysis}
                onClick={() => void handleRunCvAnalysis()}
              >
                <Sparkles size={14} />
                {loadingCvAnalysis ? "Analyzing CV…" : "Re-run AI Analysis"}
              </button>
              {data.resume_url && (
                <a href={data.resume_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  <ExternalLink size={14} /> Open Resume PDF
                </a>
              )}
              {data.resume_text && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRawResume((v) => !v)}
                >
                  {showRawResume ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showRawResume ? "Hide Raw Text" : "View Raw Resume Text"}
                </button>
              )}
            </div>
          </div>

          {cvAnalysisError && (
            <div className="delta-down" style={{ fontSize: "0.86rem" }}>
              <AlertCircle size={15} style={{ verticalAlign: "middle", marginRight: "4px" }} />
              {cvAnalysisError}
            </div>
          )}

          {loadingCvAnalysis && !cvAnalysis && (
            <div className="hr-panel" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <Sparkles size={28} className="spin-slow" style={{ color: "var(--brand-coral, #ff5b5b)", marginBottom: "0.75rem" }} />
              <h4 style={{ margin: "0 0 0.35rem 0", fontSize: "1rem" }}>Extracting & Evaluating Candidate CV…</h4>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                Parsing candidate experience graph, cross-matching technical requirements, and calculating ATS dimensions.
              </p>
            </div>
          )}

          {/* ATS Dimension Quad */}
          {cvAnalysis && (
            <>
              <div className="cv-metrics-quad">
                <div className="cv-metric-tile">
                  <div className="cv-metric-tile-title">
                    <span>Technical Fit</span>
                    <span className="cv-metric-tile-pct">{cvAnalysis.atsScores.technicalFit}%</span>
                  </div>
                  <div className="cv-bar-track">
                    <div className="cv-bar-fill bar-green" style={{ width: `${cvAnalysis.atsScores.technicalFit}%` }} />
                  </div>
                </div>

                <div className="cv-metric-tile">
                  <div className="cv-metric-tile-title">
                    <span>Experience Fit</span>
                    <span className="cv-metric-tile-pct">{cvAnalysis.atsScores.experienceRelevance}%</span>
                  </div>
                  <div className="cv-bar-track">
                    <div className="cv-bar-fill bar-blue" style={{ width: `${cvAnalysis.atsScores.experienceRelevance}%` }} />
                  </div>
                </div>

                <div className="cv-metric-tile">
                  <div className="cv-metric-tile-title">
                    <span>Domain / Education</span>
                    <span className="cv-metric-tile-pct">{cvAnalysis.atsScores.educationAndDomain}%</span>
                  </div>
                  <div className="cv-bar-track">
                    <div className="cv-bar-fill bar-purple" style={{ width: `${cvAnalysis.atsScores.educationAndDomain}%` }} />
                  </div>
                </div>

                <div className="cv-metric-tile">
                  <div className="cv-metric-tile-title">
                    <span>Impact & Clarity</span>
                    <span className="cv-metric-tile-pct">{cvAnalysis.atsScores.impactAndClarity}%</span>
                  </div>
                  <div className="cv-bar-track">
                    <div className="cv-bar-fill bar-amber" style={{ width: `${cvAnalysis.atsScores.impactAndClarity}%` }} />
                  </div>
                </div>
              </div>

              {/* Skills Analysis */}
              <div className="cv-skills-section">
                <div className="hr-panel-head" style={{ marginBottom: "0.25rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>Skills Alignment & Gap Matrix</h3>
                </div>
                <p className="hr-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                  Semantic comparison against requirements for <strong>{data.job_title}</strong>.
                </p>

                <div className="cv-skills-grid">
                  <div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#065f46" }}>
                      Matched Requirements ({cvAnalysis.skillsAnalysis.matchedSkills.length})
                    </span>
                    <div className="cv-skill-chips-row" style={{ marginTop: "0.4rem" }}>
                      {cvAnalysis.skillsAnalysis.matchedSkills.length > 0 ? (
                        cvAnalysis.skillsAnalysis.matchedSkills.map((s) => (
                          <span key={s} className="cv-chip matched">
                            <Check size={12} strokeWidth={3} /> {s}
                          </span>
                        ))
                      ) : (
                        <span className="hr-muted" style={{ fontSize: "0.82rem" }}>No direct keyword matches detected.</span>
                      )}
                    </div>
                  </div>

                  {cvAnalysis.skillsAnalysis.missingSkills.length > 0 && (
                    <div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#b45309" }}>
                        Missing / Gap Requirements ({cvAnalysis.skillsAnalysis.missingSkills.length})
                      </span>
                      <div className="cv-skill-chips-row" style={{ marginTop: "0.4rem" }}>
                        {cvAnalysis.skillsAnalysis.missingSkills.map((s) => (
                          <span key={s} className="cv-chip missing">
                            <AlertTriangle size={12} /> {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {cvAnalysis.skillsAnalysis.bonusSkills.length > 0 && (
                    <div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6d28d9" }}>
                        Bonus Capabilities ({cvAnalysis.skillsAnalysis.bonusSkills.length})
                      </span>
                      <div className="cv-skill-chips-row" style={{ marginTop: "0.4rem" }}>
                        {cvAnalysis.skillsAnalysis.bonusSkills.map((s) => (
                          <span key={s} className="cv-chip bonus">
                            + {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Strengths & Watch-outs */}
              <div className="cv-strengths-columns">
                <div className="cv-flag-box">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckCircle size={18} style={{ color: "#10b981" }} />
                    <h3 style={{ margin: 0, fontSize: "0.98rem" }}>Key Strengths (Green Flags)</h3>
                  </div>
                  <ul className="cv-flag-list">
                    {cvAnalysis.strengths.map((str, idx) => (
                      <li key={idx} className="cv-flag-item">
                        <span style={{ color: "#10b981", fontWeight: "bold" }}>•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="cv-flag-box">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <AlertCircle size={18} style={{ color: "#f59e0b" }} />
                    <h3 style={{ margin: 0, fontSize: "0.98rem" }}>Areas of Concern / Watch-outs</h3>
                  </div>
                  <ul className="cv-flag-list">
                    {cvAnalysis.concernsOrGaps.length > 0 ? (
                      cvAnalysis.concernsOrGaps.map((c, idx) => (
                        <li key={idx} className="cv-flag-item">
                          <span style={{ color: "#f59e0b", fontWeight: "bold" }}>•</span>
                          <span>{c}</span>
                        </li>
                      ))
                    ) : (
                      <li className="cv-flag-item" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                        No significant red flags or resume gaps detected.
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Recommended Tailored Interview Questions */}
              {cvAnalysis.recommendedInterviewQuestions.length > 0 && (
                <div className="cv-questions-wrap">
                  <div className="hr-panel-head" style={{ marginBottom: "0.25rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>Tailored Interview Probing Questions</h3>
                  </div>
                  <p className="hr-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                    AI-generated interview questions addressing this candidate's specific background and gap areas.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                    {cvAnalysis.recommendedInterviewQuestions.map((q, idx) => (
                      <div key={idx} className="cv-question-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                          <span className="cv-question-topic">{q.topic}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.74rem" }}
                            onClick={() => {
                              navigator.clipboard.writeText(q.question);
                              setCopiedQuestionIdx(idx);
                              setTimeout(() => setCopiedQuestionIdx(null), 2000);
                            }}
                          >
                            <Copy size={12} /> {copiedQuestionIdx === idx ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <div className="cv-question-text">{q.question}</div>
                        <div className="cv-target-signal">
                          <strong>Target Signal:</strong> {q.targetSignal}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Raw Resume Inspector */}
          {showRawResume && data.resume_text && (
            <div className="hr-panel">
              <div className="hr-panel-head">
                <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Parsed Resume Source Text</h3>
                <span className="hr-muted" style={{ fontSize: "0.78rem" }}>
                  Extracted at application time
                </span>
              </div>
              <div className="cv-raw-inspector">{data.resume_text}</div>
            </div>
          )}

          {!data.resume_url && !data.resume_text && !loadingCvAnalysis && (
            <div className="hr-empty-inline">
              No hosted resume file or text was found for this candidate.
            </div>
          )}
        </div>
      )}

      {tab === "Interviews" && (
        <div className="hr-panel">
          <div className="hr-panel-head">
            <div>
              <h3>Scheduled Interviews</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Coordinate evaluation rounds, video meetings, and candidate feedback.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-dark-pill btn-sm"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setSchedDate(tomorrow.toISOString().split("T")[0]);
                setShowScheduleModal(true);
              }}
            >
              <Plus size={14} /> Schedule Interview
            </button>
          </div>

          {loadingInterviews ? (
            <div className="hr-empty-inline">Loading interviews…</div>
          ) : interviews.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--bg-subtle, #f3f4f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1rem auto",
                }}
              >
                <Calendar size={22} color="var(--text-secondary)" />
              </div>
              <h4 style={{ margin: "0 0 0.4rem 0", fontSize: "1rem", fontWeight: 600 }}>
                No interviews scheduled yet
              </h4>
              <p style={{ margin: "0 auto 1.2rem auto", fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 360 }}>
                Schedule a screening call or technical round with {data.candidate_name}.
              </p>
              <button
                type="button"
                className="btn btn-dark-pill btn-sm"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setSchedDate(tomorrow.toISOString().split("T")[0]);
                  setShowScheduleModal(true);
                }}
              >
                <Plus size={14} /> Schedule First Round
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              {interviews.map((iv) => {
                const isPassed = new Date(iv.scheduled_at).getTime() < Date.now();
                const isCompleted = iv.status === "completed";
                const isCancelled = iv.status === "cancelled";

                return (
                  <div
                    key={iv.id}
                    style={{
                      border: "1px solid var(--border-color, rgba(0,0,0,0.08))",
                      borderRadius: "12px",
                      padding: "1.2rem",
                      background: isCompleted
                        ? "var(--bg-subtle, #f9fafb)"
                        : isCancelled
                        ? "var(--bg-subtle, #fafafa)"
                        : "var(--bg-panel, #ffffff)",
                      opacity: isCancelled ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>{iv.round_type}</span>
                          <span
                            className={`badge ${
                              isCompleted ? "badge-green" : isCancelled ? "badge-red" : "badge-blue"
                            }`}
                          >
                            {iv.status.toUpperCase()}
                          </span>
                          {!isCompleted && !isCancelled && (
                            <span style={{ fontSize: "0.75rem", color: isPassed ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                              ● {getInterviewRelative(iv.scheduled_at)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <Calendar size={13} /> {formatInterviewDateTime(iv.scheduled_at)}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <Clock size={13} /> {iv.duration_minutes} mins
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {iv.meeting_link && !isCancelled && (
                          <a
                            href={iv.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-dark-pill btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                          >
                            <Video size={13} /> Join Call <ExternalLink size={11} />
                          </a>
                        )}
                        {!isCompleted && !isCancelled && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void handleUpdateInterviewStatus(iv.id, "completed")}
                          >
                            Mark Completed
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveFeedbackId(iv.id);
                            setFeedbackText(iv.feedback || "");
                            setFeedbackRating(iv.rating || 5);
                          }}
                        >
                          <Star size={13} style={{ marginRight: 3 }} /> {iv.feedback ? "Edit Feedback" : "Add Feedback"}
                        </button>
                        {!isCancelled && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ color: "#ef4444" }}
                            onClick={() => void handleUpdateInterviewStatus(iv.id, "cancelled")}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {iv.meeting_link && (
                      <div
                        style={{
                          marginTop: "0.8rem",
                          fontSize: "0.82rem",
                          background: "var(--bg-subtle, #f3f4f6)",
                          padding: "0.4rem 0.75rem",
                          borderRadius: "6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <Video size={13} color="#2563eb" />
                        <span style={{ color: "var(--text-secondary)" }}>Link:</span>
                        <a href={iv.meeting_link} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                          {iv.meeting_link}
                        </a>
                      </div>
                    )}

                    {iv.notes && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          fontSize: "0.82rem",
                          color: "var(--text-primary)",
                          background: "rgba(0,0,0,0.02)",
                          padding: "0.6rem 0.8rem",
                          borderRadius: "6px",
                          borderLeft: "3px solid #10b981",
                        }}
                      >
                        <strong>Agenda / Instructions:</strong> {iv.notes}
                      </div>
                    )}

                    {iv.feedback && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          fontSize: "0.82rem",
                          background: "rgba(245, 158, 11, 0.08)",
                          padding: "0.6rem 0.8rem",
                          borderRadius: "6px",
                          borderLeft: "3px solid #f59e0b",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                          <span style={{ fontWeight: 600 }}>Evaluation:</span>
                          {iv.rating && (
                            <span style={{ color: "#f59e0b", display: "inline-flex", gap: "1px" }}>
                              {Array.from({ length: iv.rating }).map((_, i) => (
                                <Star key={i} size={12} fill="#f59e0b" />
                              ))}
                            </span>
                          )}
                        </div>
                        <div>{iv.feedback}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "Communication" && (
        <div className="hr-panel">
          <div className="hr-panel-head">
            <h3>Send message to candidate</h3>
          </div>

          {msgResult?.ok ? (
            <div className="cd-msg-success">
              <CheckCircle size={20} />
              <span>{msgResult.text}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMsgResult(null)}>
                Send another
              </button>
            </div>
          ) : (
            <div className="cd-compose-form">
              <div className="form-row">
                <label className="form-label">Subject</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={`Re: ${data.job_title} — ${data.candidate_name}`}
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Message</label>
                <textarea
                  className="form-input"
                  rows={6}
                  placeholder={`Hi ${data.candidate_name.split(" ")[0]},\n\nWe reviewed your application and would like to...`}
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  style={{ resize: "vertical", minHeight: "120px" }}
                />
              </div>
              {msgResult && !msgResult.ok && (
                <p className="delta-down" style={{ fontSize: "0.82rem" }}>{msgResult.text}</p>
              )}
              <div className="hr-inline-actions">
                <button
                  type="button"
                  className="btn btn-dark-pill btn-sm"
                  disabled={msgSending || !msgSubject.trim() || !msgBody.trim()}
                  onClick={() => void handleSendMessage()}
                >
                  <Send size={14} /> {msgSending ? "Sending…" : "Send Message"}
                </button>
                <a className="btn btn-secondary btn-sm" href={`mailto:${data.candidate_email}`}>
                  <Mail size={14} /> Email directly
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Offer" && (
        <div className="hr-panel">
          <div className="offer-studio-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                <Award size={20} style={{ color: "#d97706" }} />
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  Formal Offer Letter & Employment Terms
                </h3>
                {currentStatus === "hired" && (
                  <span className="offer-studio-badge">
                    <Check size={13} /> Candidate Hired / Offer Extended
                  </span>
                )}
              </div>
              <p className="hr-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Generate an official, legally formatted PDF offer letter and dispatch it directly to{" "}
                <strong>{data.candidate_email || "the candidate"}</strong> with contractual terms.
              </p>
            </div>

            {/* Toggle Form / Live Preview */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className={`btn btn-sm ${offerTabMode === "form" ? "btn-dark-pill" : "btn-secondary"}`}
                onClick={() => setOfferTabMode("form")}
              >
                <Briefcase size={14} /> Customize Terms
              </button>
              <button
                type="button"
                className={`btn btn-sm ${offerTabMode === "preview" ? "btn-dark-pill" : "btn-secondary"}`}
                onClick={() => setOfferTabMode("preview")}
              >
                <Eye size={14} /> Document Preview
              </button>
            </div>
          </div>

          {/* Success Banner if offer sent */}
          {offerResult?.ok && (
            <div className="offer-success-banner">
              <CheckCircle size={26} style={{ color: "var(--status-green)", flexShrink: 0, marginTop: "2px" }} />
              <div style={{ flex: 1 }}>
                <div className="offer-success-title">Offer Letter Successfully Issued!</div>
                <div className="offer-success-text">{offerResult.text}</div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  {offerResult.pdfBase64 && (
                    <button
                      type="button"
                      className="btn btn-dark-pill btn-sm"
                      onClick={() =>
                        downloadBase64Pdf(
                          offerResult.pdfBase64!,
                          offerResult.pdfFilename || `Offer_Letter_${data.candidate_name}.pdf`
                        )
                      }
                    >
                      <Download size={14} /> Download Sent PDF
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setOfferResult(null)}
                  >
                    Dismiss Notice
                  </button>
                </div>
              </div>
            </div>
          )}

          {offerResult && !offerResult.ok && (
            <div className="delta-down" style={{ marginBottom: "1rem", fontSize: "0.88rem" }}>
              <AlertCircle size={15} style={{ verticalAlign: "middle", marginRight: "4px" }} />
              {offerResult.text}
            </div>
          )}

          {data.isAnonymous && (
            <div className="alert-card" style={{ marginBottom: "1.25rem", padding: "0.85rem 1rem" }}>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                <strong>Offline Notice:</strong> This candidate submitted an anonymous application or has no registered email account. You can configure and download the signed PDF offer letter for direct handover.
              </p>
            </div>
          )}

          {offerTabMode === "form" ? (
            <div className="offer-form-card">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                <div className="form-row">
                  <label className="form-label">
                    <DollarSign size={13} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                    Compensation / Base Salary <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. $130,000 / year or ₹24,00,000 / year"
                    value={offerSalary}
                    onChange={(e) => setOfferSalary(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    <Calendar size={13} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                    Anticipated Start Date <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={offerStartDate}
                    onChange={(e) => setOfferStartDate(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    <Briefcase size={13} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                    Employment Type
                  </label>
                  <select
                    className="form-input"
                    value={offerEmploymentType}
                    onChange={(e) => setOfferEmploymentType(e.target.value)}
                  >
                    <option value="Full-Time">Full-Time (Permanent)</option>
                    <option value="Contract">Contract / Consultant</option>
                    <option value="Internship">Internship</option>
                    <option value="Part-Time">Part-Time</option>
                  </select>
                </div>

                <div className="form-row">
                  <label className="form-label">
                    Work Location & Mode
                  </label>
                  <select
                    className="form-input"
                    value={offerWorkLocation}
                    onChange={(e) => setOfferWorkLocation(e.target.value)}
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                    <option value="Flexible">Flexible / Distributed</option>
                  </select>
                </div>

                <div className="form-row">
                  <label className="form-label">
                    Reporting Manager / Line
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Engineering Director or VP of Product"
                    value={offerReportingManager}
                    onChange={(e) => setOfferReportingManager(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    Offer Expiration Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={offerExpiryDate}
                    onChange={(e) => setOfferExpiryDate(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    <Building size={13} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                    Issuing Entity / Company
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={offerCompanyName}
                    onChange={(e) => setOfferCompanyName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">Benefits & Perks Package</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={offerBenefitsSummary}
                  onChange={(e) => setOfferBenefitsSummary(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div className="form-row">
                <label className="form-label">Personal Welcome Note to Candidate</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={offerCustomNotes}
                  onChange={(e) => setOfferCustomNotes(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          ) : (
            /* Live Document Preview */
            <div className="offer-preview-paper">
              <div className="offer-paper-topbar">
                <div>
                  <div className="offer-paper-brand">
                    <Building size={20} />
                    <span>{offerCompanyName || "HireSight Technologies"}</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px" }}>
                    Official Letter of Employment & Agreement
                  </div>
                </div>
                <div className="offer-paper-ref">
                  <div><strong>Date:</strong> {formatDate(new Date().toISOString())}</div>
                  <div><strong>Ref:</strong> OFF-{new Date().getFullYear()}-{data.application_id?.slice(0, 6).toUpperCase() || "DEMO"}</div>
                  <div><strong>Status:</strong> {currentStatus === "hired" ? "Hired / Extended" : "Draft Offer"}</div>
                </div>
              </div>

              <div className="offer-paper-salutation">
                Dear {data.candidate_name},
              </div>

              <p className="offer-paper-body">
                On behalf of <strong>{offerCompanyName}</strong>, we are thrilled to offer you the position of{" "}
                <strong>{data.job_title}</strong>. We were thoroughly impressed by your background, achievements, and performance during our assessment and interview rounds. We are confident you will make a remarkable addition to our team.
              </p>

              <div className="offer-paper-section-title">Employment Terms & Summary</div>
              <div className="offer-terms-grid">
                <div className="offer-term-item">
                  <span className="offer-term-label">Position / Role</span>
                  <span className="offer-term-val">{data.job_title}</span>
                </div>
                <div className="offer-term-item">
                  <span className="offer-term-label">Classification</span>
                  <span className="offer-term-val">{offerEmploymentType}</span>
                </div>
                <div className="offer-term-item">
                  <span className="offer-term-label">Base Compensation</span>
                  <span className="offer-term-val" style={{ color: "#065f46" }}>{offerSalary || "Competitive"}</span>
                </div>
                <div className="offer-term-item">
                  <span className="offer-term-label">Anticipated Start Date</span>
                  <span className="offer-term-val">{offerStartDate || "To be confirmed"}</span>
                </div>
                <div className="offer-term-item">
                  <span className="offer-term-label">Work Arrangement</span>
                  <span className="offer-term-val">{offerWorkLocation}</span>
                </div>
                <div className="offer-term-item">
                  <span className="offer-term-label">Reporting Line</span>
                  <span className="offer-term-val">{offerReportingManager}</span>
                </div>
                <div className="offer-term-item">
                  <span className="offer-term-label">Offer Expiration</span>
                  <span className="offer-term-val">{offerExpiryDate || "7 Days from issuance"}</span>
                </div>
                <div className="offer-term-item">
                  <span className="offer-term-label">Candidate Recipient</span>
                  <span className="offer-term-val" style={{ fontSize: "0.82rem" }}>{data.candidate_email || "Direct Handover"}</span>
                </div>
              </div>

              {offerBenefitsSummary && (
                <>
                  <div className="offer-paper-section-title">Benefits & Additional Terms</div>
                  <p className="offer-paper-body" style={{ fontSize: "0.84rem", margin: "0.4rem 0 1rem" }}>
                    {offerBenefitsSummary}
                  </p>
                </>
              )}

              {offerCustomNotes && (
                <>
                  <div className="offer-paper-section-title">Executive Note</div>
                  <p className="offer-paper-body" style={{ fontStyle: "italic", fontSize: "0.84rem", margin: "0.4rem 0 1rem" }}>
                    "{offerCustomNotes}"
                  </p>
                </>
              )}

              <div className="offer-signatures">
                <div>
                  <div className="offer-sig-line">{offerCompanyName} Talent Board</div>
                  <div className="offer-sig-name">Authorized Signatory</div>
                  <div className="offer-sig-title">{offerCompanyName} Recruiting Operations</div>
                </div>
                <div>
                  <div className="offer-sig-line" style={{ color: "#94a3b8" }}>
                    Acceptance Signature
                  </div>
                  <div className="offer-sig-name">{data.candidate_name}</div>
                  <div className="offer-sig-title">Candidate Signature & Date</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="hr-inline-actions" style={{ marginTop: "1.25rem", borderTop: "1px solid var(--card-border)", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-dark-pill"
              disabled={offerSending || !offerSalary.trim() || !offerStartDate.trim() || !data.application_id}
              onClick={() => void handleSendOfficialOffer()}
            >
              <Send size={14} />
              {offerSending ? "Generating PDF & Dispatching Email…" : "Send Official Offer via Email (Attach PDF)"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={offerDownloading || !data.application_id}
              onClick={() => void handleDownloadOfferPreview()}
            >
              <Download size={14} />
              {offerDownloading ? "Building PDF…" : "Download PDF Copy"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOfferTabMode("preview");
                setTimeout(() => window.print(), 200);
              }}
            >
              <Printer size={14} /> Print Letter
            </button>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showScheduleModal && (
        <div
          className="hr-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowScheduleModal(false);
          }}
        >
          <div
            className="card hr-modal"
            style={{
              maxWidth: "540px",
              width: "100%",
              maxHeight: "min(90vh, 640px)",
              display: "flex",
              flexDirection: "column",
              padding: 0,
              overflow: "hidden",
              margin: "auto",
              boxShadow: "0 20px 45px rgba(0,0,0,0.22)",
            }}
          >
            {/* Modal Header (Fixed / Pinned) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 1.25rem 0.8rem",
                borderBottom: "1px solid var(--border-color, rgba(0,0,0,0.08))",
                flexShrink: 0,
                background: "var(--card-bg, #ffffff)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div
                  style={{
                    background: "var(--bg-subtle, #f3f4f6)",
                    padding: "7px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Calendar size={18} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Schedule Interview</h2>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    With {data.candidate_name} · {data.job_title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="hr-icon-btn"
                onClick={() => setShowScheduleModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form with Scrollable Body & Pinned Footer */}
            <form
              onSubmit={(e) => void handleScheduleSubmit(e)}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  overflowY: "auto",
                  flex: 1,
                  padding: "1rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                {/* Round Type Presets */}
                <div className="form-row" style={{ margin: 0 }}>
                  <label className="form-label" style={{ marginBottom: "0.3rem" }}>Interview Round</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.45rem" }}>
                    {ROUND_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`btn btn-sm ${roundType === preset ? "btn-dark-pill" : "btn-secondary"}`}
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.55rem" }}
                        onClick={() => setRoundType(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    className="form-input"
                    type="text"
                    value={roundType}
                    onChange={(e) => setRoundType(e.target.value)}
                    placeholder="Round Title (e.g. Technical Deep Dive)"
                    required
                  />
                </div>

                {/* Date & Time Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-row" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: "0.3rem" }}>Date</label>
                    <input
                      className="form-input"
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: "0.3rem" }}>Time</label>
                    <input
                      className="form-input"
                      type="time"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Duration selector */}
                <div className="form-row" style={{ margin: 0 }}>
                  <label className="form-label" style={{ marginBottom: "0.3rem" }}>Duration</label>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    {DURATION_OPTIONS.map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        className={`btn btn-sm ${durationMinutes === dur ? "btn-dark-pill" : "btn-secondary"}`}
                        style={{ flex: 1, fontSize: "0.78rem", padding: "0.25rem 0" }}
                        onClick={() => setDurationMinutes(dur)}
                      >
                        {dur}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meeting Link with Google Meet generator */}
                <div className="form-row" style={{ margin: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <label className="form-label" style={{ margin: 0 }}>Meeting Link</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}
                      onClick={generateMeetingLink}
                    >
                      <Sparkles size={11} style={{ marginRight: 3 }} /> Auto-generate Meet Link
                    </button>
                  </div>
                  <input
                    className="form-input"
                    type="url"
                    placeholder="https://meet.google.com/abc-defg-hij or Zoom URL"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                  />
                </div>

                {/* Instructions / Notes for Candidate */}
                <div className="form-row" style={{ margin: 0 }}>
                  <label className="form-label" style={{ marginBottom: "0.3rem" }}>Instructions & Agenda for Candidate</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="e.g. Please join from a quiet room. Have your code editor ready."
                    value={interviewNotes}
                    onChange={(e) => setInterviewNotes(e.target.value)}
                    style={{ resize: "vertical", minHeight: "54px" }}
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "block" }}>
                    Candidate {data?.candidate_email ? `(${data.candidate_email})` : ""} will receive an email invitation and in-app message with these details.
                  </span>
                </div>

                {scheduleError && (
                  <div style={{ color: "#ef4444", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <AlertCircle size={13} /> {scheduleError}
                  </div>
                )}
                {scheduleSuccess && (
                  <div style={{ color: "#10b981", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <CheckCircle size={13} /> {scheduleSuccess}
                  </div>
                )}
              </div>

              {/* Pinned Action Buttons (Always Visible) */}
              <div
                className="hr-modal-actions"
                style={{
                  padding: "0.85rem 1.25rem",
                  borderTop: "1px solid var(--border-color, rgba(0,0,0,0.08))",
                  background: "var(--card-bg, #ffffff)",
                  margin: 0,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={scheduling}
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-dark-pill btn-sm"
                  disabled={scheduling || !schedDate || !schedTime}
                >
                  {scheduling ? "Scheduling & Notifying…" : "Schedule & Notify Candidate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Feedback Modal */}
      {activeFeedbackId && (
        <div
          className="hr-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveFeedbackId(null);
          }}
        >
          <div
            className="card hr-modal"
            style={{
              maxWidth: "480px",
              width: "100%",
              maxHeight: "min(90vh, 520px)",
              display: "flex",
              flexDirection: "column",
              padding: 0,
              overflow: "hidden",
              margin: "auto",
              boxShadow: "0 20px 45px rgba(0,0,0,0.22)",
            }}
          >
            <div
              style={{
                padding: "1rem 1.25rem 0.8rem",
                borderBottom: "1px solid var(--border-color, rgba(0,0,0,0.08))",
                flexShrink: 0,
                background: "var(--card-bg, #ffffff)",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.2rem 0" }}>
                Interview Feedback & Rating
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                Record interviewer evaluations, technical scoring, and notes.
              </p>
            </div>

            <div style={{ padding: "1rem 1.25rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div className="form-row" style={{ margin: 0 }}>
                <label className="form-label" style={{ marginBottom: "0.3rem" }}>Score / Rating</label>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="hr-icon-btn"
                      style={{
                        color: star <= feedbackRating ? "#f59e0b" : "var(--text-muted, #ccc)",
                        padding: "4px",
                      }}
                      onClick={() => setFeedbackRating(star)}
                    >
                      <Star size={22} fill={star <= feedbackRating ? "#f59e0b" : "none"} />
                    </button>
                  ))}
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, marginLeft: "0.4rem" }}>
                    {feedbackRating} / 5
                  </span>
                </div>
              </div>

              <div className="form-row" style={{ margin: 0 }}>
                <label className="form-label" style={{ marginBottom: "0.3rem" }}>Evaluation Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Strong problem-solving ability, clear communication, solved algorithm problem efficiently. Recommend for offer."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  style={{ resize: "vertical", minHeight: "75px" }}
                />
              </div>
            </div>

            <div
              className="hr-modal-actions"
              style={{
                padding: "0.8rem 1.25rem",
                borderTop: "1px solid var(--border-color, rgba(0,0,0,0.08))",
                background: "var(--card-bg, #ffffff)",
                margin: 0,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={savingFeedback}
                onClick={() => setActiveFeedbackId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-dark-pill btn-sm"
                disabled={savingFeedback}
                onClick={() => void handleSaveFeedback(activeFeedbackId)}
              >
                {savingFeedback ? "Saving…" : "Save Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
