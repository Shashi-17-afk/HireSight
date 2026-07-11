import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import Seo from "../components/Seo";
import AuthGate from "../components/AuthGate";
import AlreadyApplied from "../components/AlreadyApplied";
import ScoreResult from "../components/ScoreResult";

// Use the bundled worker via Vite's ?url import
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

  // Auth gate — must be a logged-in candidate to apply.
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  const isCandidate = !!token && role === "candidate";
  const redirectParam = encodeURIComponent(`/apply/${job_id ?? ""}`);

  const [job, setJob] = useState<JobInfo | null>(null);
  const [jobError, setJobError] = useState("");
  const [jobLoading, setJobLoading] = useState(true);

  // Pre-populate name from the logged-in candidate's account so the
  // candidates table row is always linked to the right identity.
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
  // Seconds remaining before the rate-limit window resets (0 = not rate-limited).
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tick the rate-limit countdown down by 1 every second until it hits 0.
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

  // Fetch job details to show the job title
  useEffect(() => {
    loadJob();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Auth gate — show sign-in wall for anyone not logged in as a candidate.
  if (!isCandidate) {
    return <AuthGate job={job} role={role} redirectParam={redirectParam} />;
  }

  // Already-applied state — server returned existing application instead of re-scoring.
  if (result?.alreadyApplied) {
    return <AlreadyApplied job={job} result={result} />;
  }

  // Score result — show after successful submission.
  if (result) {
    return <ScoreResult result={result} />;
  }

  return (
    <div className="page">
      <Seo
        title={job ? `Apply — ${job.title}` : "Apply"}
        description="Submit your resume for this role. AI scores and ranks every application in real time."
        noIndex
      />
      {jobLoading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
          <span className="spinner" style={{ borderTopColor: "var(--brand)" }} />
          <p style={{ marginTop: "1rem", fontSize: ".9rem" }}>Loading job details…</p>
        </div>
      ) : jobError ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>⚠️</div>
          <p style={{ color: "var(--red)", marginBottom: "1.25rem" }}>{jobError}</p>
          <button onClick={loadJob} className="btn btn-outline" style={{ fontSize: ".85rem" }}>
            Try Again
          </button>
        </div>
      ) : (
        <>
          <h1 className="page-title">Apply for this Role</h1>
          {job && (
            <p className="page-sub">
              Applying for: <strong style={{ color: "var(--text-primary)" }}>{job.title}</strong>
            </p>
          )}

          <div className="card">
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!!storedName}
                  style={storedName ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Resume (PDF)</label>
                <div
                  className={`drop-zone ${dragover ? "dragover" : ""} ${file && extractedText ? "has-file" : ""}`}
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
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => void handleFileChange(e)}
                    required={!extractedText}
                  />
                  {extracting ? (
                    <>
                      <div className="drop-zone-icon">⏳</div>
                      <div className="drop-zone-text">Reading your PDF…</div>
                      <div className="drop-zone-sub">Extracting text with AI</div>
                    </>
                  ) : file && extractedText ? (
                    <>
                      <div className="drop-zone-icon">✅</div>
                      <div className="drop-zone-text">{file.name}</div>
                      <div className="drop-zone-sub">{extractedText.length.toLocaleString()} characters extracted — ready to score</div>
                    </>
                  ) : (
                    <>
                      <div className="drop-zone-icon">📄</div>
                      <div className="drop-zone-text">Drop your PDF here or click to browse</div>
                      <div className="drop-zone-sub">PDF files only · Text-based (not scanned)</div>
                    </>
                  )}
                </div>
                {extractError && (
                  <p className="error-text" style={{ marginTop: ".4rem" }}>⚠ {extractError}</p>
                )}
              </div>

              {submitError && (
                <p className="error-text">
                  ⚠ {submitError}
                  {rateLimitCountdown > 0 && (
                    <span style={{ marginLeft: ".5rem", fontWeight: 700 }}>
                      Try again in {rateLimitCountdown}s
                    </span>
                  )}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={submitting || extracting || !extractedText || !name.trim() || !email.trim() || rateLimitCountdown > 0}
              >
                {submitting ? (
                  <><span className="spinner" /> Scoring with AI…</>
                ) : rateLimitCountdown > 0 ? (
                  `Rate limited — wait ${rateLimitCountdown}s`
                ) : (
                  "Submit & Get AI Score →"
                )}
              </button>
            </form>
          </div>

          <p style={{ marginTop: "1rem", fontSize: ".78rem", color: "var(--text-muted)", textAlign: "center" }}>
            Your resume is analyzed instantly. Score appears immediately after submission.
          </p>
        </>
      )}
    </div>
  );
}
