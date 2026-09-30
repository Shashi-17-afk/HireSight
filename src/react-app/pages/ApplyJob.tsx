import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import Seo from "../components/Seo";
import AuthGate from "../components/AuthGate";
import AlreadyApplied from "../components/AlreadyApplied";
import ScoreResult from "../components/ScoreResult";
import { Upload, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface JobInfo {
  title: string;
  description: string;
}

interface ScoreResult {
  candidate_id?: string;
  score: number | null;
  reasoning: string | null;
  alreadyApplied?: boolean;
  application_id?: string;
  status?: string;
}

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const texts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    texts.push(pageText);
  }

  return texts.join("\n").trim();
}

export default function ApplyJob() {
  const { job_id } = useParams<{ job_id: string }>();

  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  const isCandidate = !!token && role === "candidate";
  const redirectParam = encodeURIComponent(`/apply/${job_id ?? ""}`);

  const [job, setJob] = useState<JobInfo | null>(null);
  const [jobError, setJobError] = useState("");
  const [jobLoading, setJobLoading] = useState(true);

  const storedName = isCandidate ? (localStorage.getItem("name") ?? "") : "";
  const [name, setName] = useState(storedName);
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [dragover, setDragover] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const timer = setTimeout(() => setRateLimitCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [rateLimitCountdown]);

  function loadJob() {
    if (!job_id) return;
    setJobLoading(true);
    setJobError("");
    fetch(`/api/jobs/${job_id}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { title?: string; description?: string; error?: string };
        if (d.error) setJobError(d.error);
        else setJob({ title: d.title ?? "", description: d.description ?? "" });
      })
      .catch(() => setJobError("Could not load job details"))
      .finally(() => setJobLoading(false));
  }

  useEffect(() => {
    loadJob();
  }, [job_id]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setExtractError("Please upload a PDF file.");
      return;
    }
    setFile(f);
    setExtractError("");
    setExtracting(true);
    try {
      const text = await extractTextFromPDF(f);
      if (!text || text.length < 50) {
        setExtractError("Could not extract text from this PDF. Try a text-based PDF (not a scanned image).");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setExtractedText(text);
      }
    } catch {
      setExtractError("Failed to parse PDF. Please try a different file.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!extractedText) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const storedToken  = localStorage.getItem("token");
      const storedRole   = localStorage.getItem("role");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (storedToken && storedRole === "candidate") {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      const res = await fetch("/api/candidates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          job_id,
          name: name.trim(),
          email: email.trim(),
          resume_text: extractedText,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; retryAfter?: number };
        if (res.status === 429 && data.retryAfter) {
          setRateLimitCountdown(data.retryAfter);
        }
        throw new Error(data.error ?? "Submission failed");
      }
      const data = (await res.json()) as ScoreResult;
      setResult(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isCandidate) {
    return <AuthGate job={job} role={role} redirectParam={redirectParam} />;
  }

  if (result?.alreadyApplied) {
    return <AlreadyApplied job={job} result={result} />;
  }

  if (result) {
    return <ScoreResult result={result} />;
  }

  return (
    <div className="page hr-page apply-page">
      <Seo
        title={job ? `Apply — ${job.title}` : "Apply"}
        description="Submit your resume for this role. AI scores and ranks every application in real time."
        noIndex
      />
      <Link to={job_id ? `/jobs/${job_id}` : "/jobs"} className="hr-back">
        <ArrowLeft size={14} /> Back to role
      </Link>
      {jobLoading ? (
        <div className="hr-empty-block">Loading application…</div>
      ) : jobError ? (
        <div className="hr-panel" style={{ textAlign: "center" }}>
          <AlertCircle size={28} style={{ color: "var(--status-red)", marginBottom: "0.5rem" }} />
          <p style={{ color: "var(--status-red)", marginBottom: "1.25rem", fontWeight: 600 }}>{jobError}</p>
          <button type="button" onClick={loadJob} className="btn btn-secondary btn-sm">
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="hr-profile-hero">
            <div>
              <h1>Apply for {job?.title}</h1>
              <p>Upload a text-based PDF. Workers AI scores your fit against this role in seconds.</p>
            </div>
          </div>

          <div className="hr-panel apply-form-panel">
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className="apply-field">
                <label htmlFor="apply-name">Full name</label>
                <input
                  id="apply-name"
                  type="text"
                  className="form-input"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!!storedName}
                  style={storedName ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
                  required
                />
              </div>

              <div className="apply-field">
                <label htmlFor="apply-email">Email address</label>
                <input
                  id="apply-email"
                  type="email"
                  className="form-input"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="apply-field">
                <label>Resume (PDF)</label>
                <div
                  className={`apply-dropzone${dragover ? " is-over" : ""}${file && extractedText ? " is-ready" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragover(false);
                    const dropped = e.dataTransfer.files[0];
                    if (dropped) {
                      const synth = { target: { files: [dropped] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                      void handleFileChange(synth);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => void handleFileChange(e)}
                    style={{ display: "none" }}
                    required={!extractedText}
                  />
                  {extracting ? (
                    <div>
                      <div className="apply-drop-title">Reading PDF resume…</div>
                      <div className="hr-muted sm">Extracting text for Workers AI</div>
                    </div>
                  ) : file && extractedText ? (
                    <div>
                      <CheckCircle2 size={28} style={{ color: "var(--status-green)", margin: "0 auto 0.45rem" }} />
                      <div className="apply-drop-title">{file.name}</div>
                      <div className="apply-drop-ok">
                        {extractedText.length.toLocaleString()} characters extracted — ready to score
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload size={28} style={{ color: "var(--text-muted)", margin: "0 auto 0.45rem" }} />
                      <div className="apply-drop-title">Drop your PDF here or click to browse</div>
                      <div className="hr-muted sm">PDF files only · text-based format, not a scanned image</div>
                    </div>
                  )}
                </div>
                {extractError && <p className="apply-error">{extractError}</p>}
              </div>

              {submitError && (
                <p className="apply-error">
                  {submitError}
                  {rateLimitCountdown > 0 && ` Try again in ${rateLimitCountdown}s.`}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-dark-pill btn-lg"
                style={{ width: "100%" }}
                disabled={submitting || extracting || !extractedText || !name.trim() || !email.trim() || rateLimitCountdown > 0}
              >
                {submitting ? (
                  "Scoring with Workers AI…"
                ) : rateLimitCountdown > 0 ? (
                  `Please wait ${rateLimitCountdown}s`
                ) : (
                  <>Submit application <ArrowRight size={18} /></>
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
