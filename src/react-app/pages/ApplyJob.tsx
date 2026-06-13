import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker via Vite's ?url import
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface JobInfo {
  title: string;
  description: string;
}

interface ScoreResult {
  candidate_id: string;
  score: number;
  reasoning: string;
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

  const [job, setJob] = useState<JobInfo | null>(null);
  const [jobError, setJobError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

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
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  function scoreBadgeClass(score: number) {
    if (score >= 80) return "badge badge-green";
    if (score >= 50) return "badge badge-yellow";
    return "badge badge-red";
  }

  function scoreLabel(score: number) {
    if (score >= 80) return "Strong Fit ✓";
    if (score >= 50) return "Potential Match";
    return "Not a Match";
  }

  if (result) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
            {result.score >= 80 ? "🎉" : result.score >= 50 ? "🤔" : "😔"}
          </div>
          <h2 style={{ fontSize: "1.4rem", marginBottom: ".5rem" }}>
            Your AI Score
          </h2>
          <div style={{ marginBottom: "1rem" }}>
            <span
              className={scoreBadgeClass(result.score)}
              style={{ fontSize: "2rem", padding: ".4rem 1.2rem" }}
            >
              {result.score}/100
            </span>
          </div>
          <p style={{ fontWeight: 600, marginBottom: ".5rem", color: "var(--gray-800)" }}>
            {scoreLabel(result.score)}
          </p>
          <p
            style={{
              color: "var(--gray-600)",
              fontSize: ".95rem",
              lineHeight: 1.6,
              maxWidth: "480px",
              margin: "0 auto",
            }}
          >
            {result.reasoning}
          </p>
          <p
            style={{
              marginTop: "1.5rem",
              fontSize: ".8rem",
              color: "var(--gray-400)",
            }}
          >
            Your application has been submitted. The hiring team will be in touch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {jobError ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: ".75rem" }}>⚠️</div>
          <p style={{ color: "var(--red)" }}>{jobError}</p>
        </div>
      ) : (
        <>
          <h1 className="page-title">Apply for this Role</h1>
          {job && (
            <p className="page-sub">
              Applying for: <strong>{job.title}</strong>
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
                <label htmlFor="resume">Resume (PDF)</label>
                <input
                  id="resume"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => void handleFileChange(e)}
                  required
                  style={{ padding: ".5rem .875rem" }}
                />
                {extracting && (
                  <p style={{ fontSize: ".82rem", color: "var(--brand)", marginTop: ".35rem" }}>
                    ⏳ Extracting text from PDF…
                  </p>
                )}
                {extractError && (
                  <p style={{ fontSize: ".82rem", color: "var(--red)", marginTop: ".35rem" }}>
                    {extractError}
                  </p>
                )}
                {file && extractedText && !extracting && (
                  <p style={{ fontSize: ".82rem", color: "var(--green)", marginTop: ".35rem" }}>
                    ✓ {file.name} — {extractedText.length.toLocaleString()} characters extracted
                  </p>
                )}
              </div>

              {submitError && (
                <p style={{ color: "var(--red)", fontSize: ".875rem", marginBottom: "1rem" }}>
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  submitting || extracting || !extractedText || !name.trim() || !email.trim()
                }
                style={{ width: "100%" }}
              >
                {submitting ? (
                  <><span className="spinner" /> Scoring your resume with AI…</>
                ) : (
                  "Submit & Get AI Score"
                )}
              </button>
            </form>
          </div>

          <p
            style={{
              marginTop: "1rem",
              fontSize: ".8rem",
              color: "var(--gray-400)",
              textAlign: "center",
            }}
          >
            Your resume is analyzed instantly by AI. You'll see your score immediately.
          </p>
        </>
      )}
    </div>
  );
}
