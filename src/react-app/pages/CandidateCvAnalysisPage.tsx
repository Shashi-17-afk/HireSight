import { useState, useEffect } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, Target, Lightbulb, RefreshCw } from "lucide-react";
import Seo from "../components/Seo";
import { authHeaders } from "../lib/hr";

interface CandidateCvAudit {
  atsScore: number;
  verdict: string;
  levelDetected: string;
  summary: string;
  detectedSkills: string[];
  missingKeywords: string[];
  metrics: {
    actionVerbStrength: number;
    quantificationScore: number;
    atsReadability: number;
    keywordMatchRate: number;
  };
  strengths: string[];
  keyImprovements: string[];
  interviewPrepTips: string[];
}

export default function CandidateCvAnalysisPage() {
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState("Full Stack Developer");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<CandidateCvAudit | null>(null);
  const [error, setError] = useState("");
  const [hasDefaultResume, setHasDefaultResume] = useState(false);

  // On mount, auto-trigger analysis with their latest uploaded/applied resume
  useEffect(() => {
    async function initAudit() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/profile/cv-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ targetRole }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          audit?: CandidateCvAudit;
          resumeSnippet?: string;
          hasResume?: boolean;
          error?: string;
        };
        if (res.ok && data.audit) {
          setAudit(data.audit);
          setHasDefaultResume(true);
        } else if (data.error && data.hasResume === false) {
          // No previous resume found, user can paste one
          setHasDefaultResume(false);
        }
      } catch {
        // user will paste
      } finally {
        setLoading(false);
      }
    }
    void initAudit();
  }, []);

  async function handleAnalyze(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile/cv-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          resumeText: resumeText.trim() || undefined,
          targetRole: targetRole.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        audit?: CandidateCvAudit;
        error?: string;
      };
      if (!res.ok || !data.audit) {
        throw new Error(data.error ?? "Failed to analyze resume.");
      }
      setAudit(data.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cd-page">
      <Seo
        title="AI CV Analysis & ATS Optimizer · HireSight"
        description="Scan your resume with AI against ATS algorithms, identify missing keywords, and get tailored career optimization tips."
      />

      {/* Header */}
      <div className="cd-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.75rem", borderRadius: "9999px", background: "var(--pill-green-bg)", color: "#065f46", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            <Sparkles size={13} /> ATS Scanner & Career Optimizer
          </div>
          <h1 className="cd-title" style={{ fontSize: "1.85rem", marginBottom: "0.5rem" }}>
            AI CV Analysis & Optimizer
          </h1>
          <p className="cd-subtitle" style={{ fontSize: "0.95rem", lineHeight: 1.5, maxWidth: 640 }}>
            Analyze your resume using Cloudflare Workers AI. Detect formatting flaws, discover missing high-demand tech keywords, and optimize your callback probability.
          </p>
        </div>
      </div>

      {/* Configuration & Input Bar */}
      <div className="hr-panel" style={{ marginBottom: "1.5rem" }}>
        <form onSubmit={handleAnalyze}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px auto", gap: "1rem", alignItems: "flex-end" }}>
            <div className="form-row" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Target size={13} /> Target Career Role / Job Title
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Full Stack Developer, Frontend Engineer, Cloud Architect"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>

            <div className="form-row" style={{ margin: 0 }}>
              <label className="form-label">Analysis Mode</label>
              <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", paddingTop: "0.6rem" }}>
                {hasDefaultResume && !resumeText ? "Using latest application CV" : "Custom pasted CV"}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-dark-pill"
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <RefreshCw size={14} className={loading ? "spin-slow" : ""} />
              {loading ? "Analyzing CV…" : "Run AI Scan"}
            </button>
          </div>

          {/* Optional Paste Text Area */}
          <div style={{ marginTop: "1rem" }}>
            <details style={{ fontSize: "0.85rem" }}>
              <summary style={{ cursor: "pointer", color: "var(--brand)", fontWeight: 600 }}>
                {resumeText ? "Edit Custom Resume Text" : "+ Paste or update custom resume text"}
              </summary>
              <div style={{ marginTop: "0.75rem" }}>
                <textarea
                  className="form-input"
                  rows={6}
                  placeholder="Paste your raw resume text or portfolio highlights here to analyze a new draft..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  style={{ resize: "vertical", fontFamily: "monospace", fontSize: "0.82rem" }}
                />
              </div>
            </details>
          </div>
        </form>

        {error && (
          <div className="delta-down" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
            <AlertTriangle size={15} style={{ verticalAlign: "middle", marginRight: "4px" }} />
            {error}
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && !audit && (
        <div className="hr-panel" style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
          <Sparkles size={32} className="spin-slow" style={{ color: "var(--brand-coral, #ff5b5b)", margin: "0 auto 1rem auto" }} />
          <h3 style={{ margin: "0 0 0.4rem 0" }}>Evaluating Resume against ATS Algorithms…</h3>
          <p className="hr-muted" style={{ margin: 0, fontSize: "0.86rem" }}>
            Benchmarking technical skill density, action verbs, and keyword coverage.
          </p>
        </div>
      )}

      {/* Audit Report View */}
      {audit && (
        <div className="cv-studio-wrap">
          {/* Hero Verdict Card */}
          <div className="cv-hero-card">
            <div className="cv-verdict-group">
              <div
                className={`cv-score-circle ${
                  audit.atsScore >= 80 ? "" : audit.atsScore >= 60 ? "score-amber" : "score-red"
                }`}
              >
                <span>{audit.atsScore}%</span>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase" }}>ATS Score</span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                    {audit.verdict}
                  </h3>
                  <span className="badge badge-yellow" style={{ fontSize: "0.76rem" }}>
                    {audit.levelDetected}
                  </span>
                </div>
                <p className="hr-muted" style={{ margin: "4px 0 0 0", fontSize: "0.86rem", maxWidth: 620 }}>
                  {audit.summary}
                </p>
              </div>
            </div>

            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleAnalyze()}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? "spin-slow" : ""} /> Re-scan
              </button>
            </div>
          </div>

          {/* ATS Metric Bars */}
          <div className="cv-metrics-quad">
            <div className="cv-metric-tile">
              <div className="cv-metric-tile-title">
                <span>Action Verb Strength</span>
                <span className="cv-metric-tile-pct">{audit.metrics.actionVerbStrength}%</span>
              </div>
              <div className="cv-bar-track">
                <div className="cv-bar-fill bar-green" style={{ width: `${audit.metrics.actionVerbStrength}%` }} />
              </div>
            </div>

            <div className="cv-metric-tile">
              <div className="cv-metric-tile-title">
                <span>Outcome Quantification</span>
                <span className="cv-metric-tile-pct">{audit.metrics.quantificationScore}%</span>
              </div>
              <div className="cv-bar-track">
                <div className="cv-bar-fill bar-blue" style={{ width: `${audit.metrics.quantificationScore}%` }} />
              </div>
            </div>

            <div className="cv-metric-tile">
              <div className="cv-metric-tile-title">
                <span>ATS Readability</span>
                <span className="cv-metric-tile-pct">{audit.metrics.atsReadability}%</span>
              </div>
              <div className="cv-bar-track">
                <div className="cv-bar-fill bar-purple" style={{ width: `${audit.metrics.atsReadability}%` }} />
              </div>
            </div>

            <div className="cv-metric-tile">
              <div className="cv-metric-tile-title">
                <span>Keyword Coverage</span>
                <span className="cv-metric-tile-pct">{audit.metrics.keywordMatchRate}%</span>
              </div>
              <div className="cv-bar-track">
                <div className="cv-bar-fill bar-amber" style={{ width: `${audit.metrics.keywordMatchRate}%` }} />
              </div>
            </div>
          </div>

          {/* Keyword Radar */}
          <div className="cv-skills-section">
            <div className="hr-panel-head" style={{ marginBottom: "0.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>ATS Skill Graph & Keyword Optimization</h3>
            </div>
            <p className="hr-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Keywords parsed from your CV versus high-impact skills employers filter for in {targetRole}.
            </p>

            <div className="cv-skills-grid">
              <div>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#065f46" }}>
                  Detected Core Skills ({audit.detectedSkills.length})
                </span>
                <div className="cv-skill-chips-row" style={{ marginTop: "0.4rem" }}>
                  {audit.detectedSkills.map((s) => (
                    <span key={s} className="cv-chip matched">
                      <CheckCircle2 size={12} /> {s}
                    </span>
                  ))}
                </div>
              </div>

              {audit.missingKeywords.length > 0 && (
                <div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#b45309" }}>
                    Recommended Keywords to Add ({audit.missingKeywords.length})
                  </span>
                  <div className="cv-skill-chips-row" style={{ marginTop: "0.4rem" }}>
                    {audit.missingKeywords.map((s) => (
                      <span key={s} className="cv-chip missing">
                        + {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Strengths & Immediate Fixes */}
          <div className="cv-strengths-columns">
            <div className="cv-flag-box">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                <h3 style={{ margin: 0, fontSize: "0.98rem" }}>What's Working Well</h3>
              </div>
              <ul className="cv-flag-list">
                {audit.strengths.map((s, idx) => (
                  <li key={idx} className="cv-flag-item">
                    <span style={{ color: "#10b981", fontWeight: "bold" }}>•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="cv-flag-box">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Lightbulb size={18} style={{ color: "#f59e0b" }} />
                <h3 style={{ margin: 0, fontSize: "0.98rem" }}>High-Impact Improvements</h3>
              </div>
              <ul className="cv-flag-list">
                {audit.keyImprovements.map((imp, idx) => (
                  <li key={idx} className="cv-flag-item">
                    <span style={{ color: "#f59e0b", fontWeight: "bold" }}>•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Interview Advice */}
          {audit.interviewPrepTips.length > 0 && (
            <div className="cv-questions-wrap">
              <div className="hr-panel-head" style={{ marginBottom: "0.25rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>Technical Interview Prep Recommendations</h3>
              </div>
              <p className="hr-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                Key areas recruiters and technical interviewers are likely to press based on your profile.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
                {audit.interviewPrepTips.map((tip, idx) => (
                  <div key={idx} className="cv-question-card" style={{ padding: "0.85rem 1.1rem" }}>
                    <div style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--text-primary)" }}>
                      <strong>{idx + 1}.</strong> {tip}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
