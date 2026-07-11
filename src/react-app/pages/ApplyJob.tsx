import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import Seo from "../components/Seo";

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch job details to show the job title
  useEffect(() => {
    if (!job_id) return;
    fetch(`/api/jobs/${job_id}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { title?: string; description?: string; error?: string };
        if (d.error) setJobError(d.error);
        else setJob({ title: d.title ?? "", description: d.description ?? "" });
      })
      .catch(() => setJobError("Could not load job details"));
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
        const data = (await res.json()) as { error?: string };
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

  function scoreLabel(score: number) {
    if (score >= 80) return "Strong Fit ✓";
    if (score >= 50) return "Potential Match";
    return "Not a Match";
  }

  // Auth gate — show sign-in wall for anyone not logged in as a candidate.
  if (!isCandidate) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="card" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "2.8rem", marginBottom: "1.25rem" }}>🔒</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: ".75rem", letterSpacing: "-.01em" }}>
            Sign in to apply
          </h2>
          {job && (
            <p style={{ color: "var(--text-secondary)", fontSize: ".92rem", marginBottom: "1.75rem", lineHeight: 1.65 }}>
              You need a candidate account to apply for <strong style={{ color: "var(--text-primary)" }}>{job.title}</strong>.
              It only takes a minute to get started.
            </p>
          )}
          {!job && (
            <p style={{ color: "var(--text-secondary)", fontSize: ".92rem", marginBottom: "1.75rem" }}>
              You need a candidate account to apply for this role.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
            <Link
              to={`/login/candidate?redirect=${redirectParam}`}
              className="btn btn-primary btn-full"
              style={{ justifyContent: "center" }}
            >
              Sign in →
            </Link>
            <Link
              to={`/register/candidate?redirect=${redirectParam}`}
              className="btn btn-outline btn-full"
              style={{ justifyContent: "center" }}
            >
              Create a free account
            </Link>
          </div>
          {role === "HR" && (
            <p style={{ marginTop: "1.5rem", fontSize: ".8rem", color: "var(--text-muted)" }}>
              You're signed in as an HR user. Applications require a candidate account.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Already-applied state — server returned existing application instead of re-scoring.
  if (result?.alreadyApplied) {
    const STATUS_LABEL: Record<string, string> = {
      applied: "Applied", under_review: "Under Review", shortlisted: "Shortlisted",
      interview: "Interview Scheduled", rejected: "Not Selected", hired: "Hired 🎉",
    };
    return (
      <div className="page">
        <div className="card score-result-card">
          <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>📋</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: ".5rem" }}>
            You've already applied
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", fontSize: ".9rem" }}>
            Your application for <strong style={{ color: "var(--text-primary)" }}>{job?.title}</strong> is already on file.
          </p>
          {result.status && (
            <p style={{ marginBottom: "1rem" }}>
              Status: <strong style={{ color: "var(--text-primary)" }}>
                {STATUS_LABEL[result.status] ?? result.status}
              </strong>
            </p>
          )}
          {result.score != null && (
            <p style={{ color: "var(--text-secondary)", fontSize: ".88rem", marginBottom: "1.5rem" }}>
              AI match score: <strong style={{ color: "var(--text-primary)" }}>{result.score}/100</strong>
              {result.reasoning && ` — ${result.reasoning}`}
            </p>
          )}
          <a href="/candidate/dashboard" className="btn btn-primary" style={{ display: "inline-flex" }}>
            View My Applications →
          </a>
        </div>
      </div>
    );
  }

  if (result) {
    const score  = result.score  ?? 0;
    const radius = 72;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (score / 100) * circ;
    const fillClass =
      score >= 80
        ? "score-circle-fill-green"
        : score >= 50
        ? "score-circle-fill-yellow"
        : "score-circle-fill-red";
    const scoreColor =
      score >= 80 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";

    return (
      <div className="page">
        <div className="card score-result-card">
          <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>
            {score >= 80 ? "🎉" : score >= 50 ? "🤔" : "😔"}
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", letterSpacing: "-.02em" }}>
            Your AI Match Score
          </h2>

          <div className="score-circle-wrap">
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle className="score-circle-bg" cx="90" cy="90" r={radius} strokeWidth="10" />
              <circle
                className={`score-circle-fill ${fillClass}`}
                cx="90" cy="90" r={radius}
                strokeWidth="10"
                strokeDasharray={circ}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="score-circle-text">
              <span className="score-number" style={{ color: scoreColor }}>{score}</span>
              <span className="score-denom">/ 100</span>
            </div>
          </div>

          <p className="score-label-text" style={{ color: scoreColor }}>{scoreLabel(score)}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: ".93rem", lineHeight: 1.65, maxWidth: "480px", margin: "0 auto 1.5rem" }}>
            {result.reasoning}
          </p>
          <p style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
            Application submitted. The hiring team will review your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Seo
        title={job ? `Apply — ${job.title}` : "Apply"}
        description="Submit your resume for this role. AI scores and ranks every application in real time."
        noIndex
      />
      {jobError ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>⚠️</div>
          <p style={{ color: "var(--red)" }}>{jobError}</p>
        </div>
      ) : (
        <>
          <h1 className="page-title">Apply for this Role</h1>
          {job ? (
            <p className="page-sub">
              Applying for: <strong style={{ color: "var(--text-primary)" }}>{job.title}</strong>
            </p>
          ) : (
            <p className="page-sub">Loading job details…</p>
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
                <p className="error-text">⚠ {submitError}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={submitting || extracting || !extractedText || !name.trim() || !email.trim()}
              >
                {submitting ? (
                  <><span className="spinner" /> Scoring with AI…</>
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
