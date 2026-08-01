import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import Seo from "../components/Seo";
import AuthGate from "../components/AuthGate";
import AlreadyApplied from "../components/AlreadyApplied";
import ScoreResult from "../components/ScoreResult";
import { Upload, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

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
    <div className="page" style={{ maxWidth: "700px" }}>
      <Seo
        title={job ? `Apply — ${job.title}` : "Apply"}
        description="Submit your resume for this role. AI scores and ranks every application in real time."
        noIndex
      />
      {jobLoading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
          <p style={{ fontSize: "1.05rem" }}>Loading job details...</p>
        </div>
      ) : jobError ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
          <AlertCircle size={36} style={{ color: "var(--status-red)", marginBottom: "0.5rem" }} />
          <p style={{ color: "var(--status-red)", marginBottom: "1.25rem", fontWeight: 600 }}>{jobError}</p>
          <button onClick={loadJob} className="btn btn-secondary btn-sm">
            Try Again
          </button>
        </div>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <span className="section-tag">Instant AI Screener</span>
            <h1 style={{ fontSize: "2.5rem", margin: "0.5rem 0" }}>
              Apply for <span className="pill-highlight pill-yellow">{job?.title}</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
              Upload your PDF resume to receive instant AI scoring & live leaderboard rank.
            </p>
          </div>

          <div className="card">
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                  Full Name
                </label>
                <input
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

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                  Resume (PDF format)
                </label>
                <div
                  style={{
                    border: dragover ? "2px dashed var(--brand)" : "2px dashed var(--card-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "2.5rem 1.5rem",
                    textAlign: "center",
                    background: dragover ? "var(--pill-yellow-bg)" : "var(--card-bg-alt)",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
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
                      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
                      <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Reading PDF resume...</div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>Extracting text for Workers AI</div>
                    </div>
                  ) : file && extractedText ? (
                    <div>
                      <CheckCircle2 size={36} style={{ color: "var(--status-green)", margin: "0 auto 0.5rem" }} />
                      <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{file.name}</div>
                      <div style={{ color: "var(--status-green)", fontSize: "0.88rem", fontWeight: 600, marginTop: "0.25rem" }}>
                        {extractedText.length.toLocaleString()} characters extracted — ready for scoring
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload size={36} style={{ color: "var(--text-muted)", margin: "0 auto 0.5rem" }} />
                      <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Drop your PDF here or click to browse</div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>PDF files only · Text-based format</div>
                    </div>
                  )}
                </div>
                {extractError && (
                  <p style={{ color: "var(--status-red)", fontSize: "0.85rem", marginTop: "0.5rem", fontWeight: 600 }}>
                    ⚠ {extractError}
                  </p>
                )}
              </div>

              {submitError && (
                <p style={{ color: "var(--status-red)", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}>
                  ⚠ {submitError}
                  {rateLimitCountdown > 0 && (
                    <span style={{ marginLeft: "0.5rem" }}>
                      Try again in {rateLimitCountdown}s
                    </span>
                  )}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-dark-pill btn-lg"
                style={{ width: "100%" }}
                disabled={submitting || extracting || !extractedText || !name.trim() || !email.trim() || rateLimitCountdown > 0}
              >
                {submitting ? (
                  "Scoring with Workers AI..."
                ) : rateLimitCountdown > 0 ? (
                  `Please wait ${rateLimitCountdown}s`
                ) : (
                  <>Submit Application <ArrowRight size={18} /></>
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
