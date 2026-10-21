import { useState, useEffect, useMemo, useRef } from "react";
import {
  Sparkles,
  Building,
  Target,
  DollarSign,
  MapPin,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Lightbulb,
  ExternalLink,
  Upload,
  FileCheck,
  FileType,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { authHeaders } from "../lib/hr";
import CompanyLogo from "./CompanyLogo";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface MangoRole {
  id: string;
  company: "Meta" | "Apple" | "Netflix" | "Google" | "OpenAI" | "Cloudflare" | "Stripe" | "Anthropic" | "Amazon";
  companyInitial: string;
  companyColor: string;
  title: string;
  category: "AI / ML & Foundation Models" | "Distributed Systems & Cloud" | "Security & Core Systems" | "Full-Stack & Platforms";
  level: "Senior" | "Staff" | "Principal";
  location: string;
  workMode: "Remote" | "Hybrid" | "In-Office";
  salary: string;
  trendingBadge: string;
  description: string;
  requirements: string[];
  skills: string[];
  officialUrl: string;
  companyHiringBarTip: string;
}

interface MatchResult {
  roleId: string;
  roleTitle: string;
  company: string;
  matchScore: number;
  verdict: string;
  confidence: string;
  matchedSkills: string[];
  missingKeywords: string[];
  strengths: string[];
  resumeGaps: string[];
  insiderInterviewAdvice: string;
}

const COMPANIES = [
  "All",
  "Meta",
  "Apple",
  "Netflix",
  "Google",
  "OpenAI",
  "Cloudflare",
  "Stripe",
  "Anthropic",
  "Amazon",
];

const CATEGORIES = [
  "All Categories",
  "AI / ML & Foundation Models",
  "Distributed Systems & Cloud",
  "Security & Core Systems",
  "Full-Stack & Platforms",
];

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MangoTrendingSection({
  title = "🔥 MANGO & Trending Roles",
  subtitle = "Directly curated high-demand roles from Meta, Apple, Netflix, Google, OpenAI, Cloudflare, Stripe & frontier labs with real-time AI Match Simulator.",
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const [roles, setRoles] = useState<MangoRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [search, setSearch] = useState("");

  // Modal State
  const [simRole, setSimRole] = useState<MangoRole | null>(null);
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [cvText, setCvText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState("");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/mango/roles")
      .then((res) => res.json())
      .then((data: unknown) => {
        const d = data as { roles?: MangoRole[] };
        if (d.roles) setRoles(d.roles);
      })
      .catch((err) => console.error("Could not fetch MANGO roles:", err))
      .finally(() => setLoading(false));
  }, []);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchComp = selectedCompany === "All" || r.company.toLowerCase() === selectedCompany.toLowerCase();
      const matchCat = selectedCategory === "All Categories" || r.category.toLowerCase().includes(selectedCategory.toLowerCase().slice(0, 5));
      const matchSearch =
        !search.trim() ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.company.toLowerCase().includes(search.toLowerCase()) ||
        r.skills.some((s) => s.toLowerCase().includes(search.toLowerCase())) ||
        r.description.toLowerCase().includes(search.toLowerCase());

      return matchComp && matchCat && matchSearch;
    });
  }, [roles, selectedCompany, selectedCategory, search]);

  function startSimulation(role: MangoRole) {
    setSimRole(role);
    setMatchResult(null);
    setEvalError("");
    setEvaluating(false);
    setSelectedFile(null);
    setCvText("");
    setInputMode("pdf");
  }

  async function handlePdfFile(file: File) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setEvalError("Please upload a valid PDF document (.pdf).");
      return;
    }
    setEvalError("");
    setSelectedFile(file);
    setParsingPdf(true);

    try {
      const text = await extractTextFromPDF(file);
      if (!text || text.length < 30) {
        setEvalError("Could not extract readable text from this PDF. Please ensure it is not an image-only scan, or use the paste text option.");
        setParsingPdf(false);
        return;
      }
      setCvText(text);
      setParsingPdf(false);
    } catch (err) {
      console.error("PDF parse error:", err);
      setEvalError("Could not read PDF. Please check the file or paste your resume text manually.");
      setParsingPdf(false);
    }
  }

  async function executeEvaluation(resumeString: string) {
    if (!simRole) return;
    if (!resumeString.trim() || resumeString.trim().length < 25) {
      setEvalError("Please upload a resume PDF or enter at least 25 characters of experience.");
      return;
    }

    setEvaluating(true);
    setEvalError("");
    setMatchResult(null);

    try {
      const res = await fetch("/api/mango/simulate-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          roleId: simRole.id,
          cvText: resumeString.trim(),
        }),
      });

      const data = (await res.json()) as MatchResult & { error?: string };
      if (!res.ok || data.error) {
        setEvalError(data.error || "Could not analyze resume. Please try again.");
      } else {
        setMatchResult(data);
      }
    } catch {
      setEvalError("Network error during evaluation. Please try again.");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <section className="mango-section" style={{ margin: compact ? "1.5rem 0" : "2.5rem 0" }}>
      {/* Header Banner */}
      <div
        className="mango-header-banner"
        style={{
          background: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)",
          borderRadius: "16px",
          padding: "2rem",
          color: "#fff",
          marginBottom: "1.75rem",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div style={{ position: "relative", zIndex: 2, maxWidth: 780 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 107, 0, 0.2)",
              color: "#ff8c38",
              border: "1px solid rgba(255, 140, 56, 0.35)",
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.8rem",
              fontWeight: 700,
              marginBottom: "0.75rem",
              letterSpacing: "0.02em",
            }}
          >
            <Sparkles size={13} /> MANGOES & Trending Radar
          </div>
          <h2
            style={{
              fontSize: compact ? "1.65rem" : "2.1rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "0 0 0.5rem 0",
              color: "#ffffff",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.55,
              color: "#d4d4d8",
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Ambient glow accent */}
        <div
          style={{
            position: "absolute",
            right: "-80px",
            top: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(243, 128, 32, 0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Filter and Search Controls */}
      <div
        className="mango-controls"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Top row: Search & Company pills */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", justifyContent: "space-between" }}>
          {/* Company filter tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            {COMPANIES.map((comp) => {
              const active = selectedCompany === comp;
              return (
                <button
                  key={comp}
                  type="button"
                  onClick={() => setSelectedCompany(comp)}
                  style={{
                    padding: "0.35rem 0.8rem",
                    borderRadius: "9999px",
                    fontSize: "0.82rem",
                    fontWeight: active ? 700 : 500,
                    border: active ? "1px solid #18181b" : "1px solid var(--border)",
                    background: active ? "#18181b" : "var(--card-bg, #fff)",
                    color: active ? "#fff" : "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {comp}
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div style={{ position: "relative", minWidth: 260, maxWidth: 320, width: "100%" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "0.85rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Filter by skill, role, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "0.45rem 0.85rem 0.45rem 2.3rem",
                borderRadius: "9999px",
                border: "1px solid var(--border)",
                fontSize: "0.84rem",
                background: "var(--card-bg, #fff)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "0.25rem 0.65rem",
                  borderRadius: "6px",
                  fontSize: "0.78rem",
                  fontWeight: active ? 600 : 400,
                  background: active ? "rgba(37, 99, 235, 0.1)" : "transparent",
                  color: active ? "#2563eb" : "var(--text-muted)",
                  border: active ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid transparent",
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Role Cards List */}
      {loading ? (
        <div className="hr-empty-block" style={{ padding: "3rem", textAlign: "center" }}>
          <Sparkles size={28} className="spin" style={{ marginBottom: "0.5rem", color: "#f38020" }} />
          <p style={{ color: "var(--text-muted)" }}>Loading MANGO & Trending Roles Radar…</p>
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="hr-empty-block" style={{ padding: "3rem", textAlign: "center", border: "1px dashed var(--border)", borderRadius: "12px" }}>
          <Building size={32} style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }} />
          <p style={{ fontWeight: 600, margin: 0 }}>No matching roles found.</p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Try clearing search keywords or switching filters.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="mango-card"
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "1.35rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1rem",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              <div>
                {/* Header: Company Avatar + Title + Badges */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", marginBottom: "0.75rem" }}>
                  <CompanyLogo company={role.company} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{role.company}</span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: "rgba(243, 128, 32, 0.1)",
                          color: "#c25e00",
                        }}
                      >
                        {role.trendingBadge}
                      </span>
                    </div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.05rem",
                        fontWeight: 700,
                        lineHeight: 1.35,
                        color: "var(--text-primary)",
                      }}
                    >
                      {role.title}
                    </h3>
                  </div>
                </div>

                {/* Meta row: Salary + Location + Work Mode */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.82rem",
                    color: "var(--text-muted)",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid var(--border)",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 700, color: "#16a34a" }}>
                    <DollarSign size={14} /> {role.salary}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <MapPin size={13} /> {role.location}
                  </span>
                  <span
                    style={{
                      background: "var(--pill-bg, #f4f4f5)",
                      padding: "0.1rem 0.45rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {role.workMode}
                  </span>
                </div>

                {/* Excerpt */}
                <p
                  style={{
                    fontSize: "0.85rem",
                    lineHeight: 1.45,
                    color: "var(--text-secondary, #52525b)",
                    margin: "0 0 0.85rem 0",
                  }}
                >
                  {role.description}
                </p>

                {/* Skills tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {role.skills.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: "0.73rem",
                        fontWeight: 600,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        background: "var(--pill-bg, #f4f4f5)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem",
                  paddingTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => startSimulation(role)}
                  className="btn btn-sm"
                  style={{
                    background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    borderRadius: "8px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.5rem",
                  }}
                >
                  <Target size={14} style={{ color: "#f38020" }} /> Test CV Match
                </button>

                <a
                  href={role.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    borderRadius: "8px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    textDecoration: "none",
                    padding: "0.5rem",
                  }}
                >
                  Official Page <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI Match Simulator Modal ────────────────────────────────────────── */}
      {simRole && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSimRole(null);
          }}
        >
          <div
            style={{
              background: "var(--card-bg, #ffffff)",
              color: "var(--text-primary)",
              borderRadius: "16px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--border)",
              padding: "1.75rem",
              position: "relative",
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSimRole(null)}
              style={{
                position: "absolute",
                right: "1.25rem",
                top: "1.25rem",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <CompanyLogo company={simRole.company} size={44} />
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                  AI Bar-Raiser Match Simulator · {simRole.company}
                </div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  {simRole.title}
                </h3>
              </div>
            </div>

            {/* Loading / Evaluating State */}
            {evaluating && (
              <div style={{ padding: "2.75rem 1rem", textAlign: "center" }}>
                <Sparkles size={38} className="spin" style={{ color: "#f38020", marginBottom: "1rem" }} />
                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem", fontWeight: 700 }}>
                  Evaluating CV Against {simRole.company} Bar…
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
                  Workers AI (@cf/meta/llama-3.1-8b-instruct-fast) is reviewing your resume against {simRole.company}'s requirements, detecting missing tech keywords, and generating bar-raiser advice.
                </p>
              </div>
            )}

            {/* Error Notification */}
            {!evaluating && evalError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "10px",
                  padding: "0.85rem 1rem",
                  marginBottom: "1.25rem",
                  fontSize: "0.86rem",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>{evalError}</div>
              </div>
            )}

            {/* ── PDF Upload & Input Section (shown when no results yet) ──────────────── */}
            {!evaluating && !matchResult && (
              <div>
                {/* Mode Selector Tabs */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "1.25rem",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "0.5rem",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setInputMode("pdf")}
                    style={{
                      padding: "0.35rem 0.85rem",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      fontWeight: inputMode === "pdf" ? 700 : 500,
                      background: inputMode === "pdf" ? "var(--pill-bg, #f4f4f5)" : "transparent",
                      color: inputMode === "pdf" ? "var(--text-primary)" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <Upload size={14} /> Upload Resume (PDF)
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode("text")}
                    style={{
                      padding: "0.35rem 0.85rem",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      fontWeight: inputMode === "text" ? 700 : 500,
                      background: inputMode === "text" ? "var(--pill-bg, #f4f4f5)" : "transparent",
                      color: inputMode === "text" ? "var(--text-primary)" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <FileType size={14} /> Paste Plain Text
                  </button>
                </div>

                {inputMode === "pdf" ? (
                  <div>
                    {/* PDF Dropzone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const files = e.dataTransfer.files;
                        if (files && files[0]) {
                          handlePdfFile(files[0]);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: dragOver ? "2px dashed #f38020" : selectedFile ? "2px solid #16a34a" : "2px dashed var(--border)",
                        background: dragOver ? "rgba(243, 128, 32, 0.05)" : selectedFile ? "rgba(22, 163, 74, 0.04)" : "var(--input-bg, #fafafa)",
                        borderRadius: "12px",
                        padding: "2rem 1.5rem",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        marginBottom: "1.25rem",
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePdfFile(f);
                        }}
                      />

                      {selectedFile ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                          <FileCheck size={40} style={{ color: "#16a34a" }} />
                          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                            {selectedFile.name}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {formatBytes(selectedFile.size)} · {parsingPdf ? "Extracting PDF text…" : "✓ Ready to simulate match"}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setCvText("");
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            style={{
                              fontSize: "0.75rem",
                              color: "#dc2626",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              textDecoration: "underline",
                              marginTop: "0.25rem",
                            }}
                          >
                            Choose another PDF
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
                          <div
                            style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "50%",
                              background: "rgba(243, 128, 32, 0.1)",
                              color: "#f38020",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Upload size={22} />
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                              Click to select your Resume PDF
                            </span>
                            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>
                              or drag and drop your PDF file here
                            </span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                            Evaluated client-side for total privacy. Instant Workers AI match scoring.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      disabled={!selectedFile || parsingPdf || evaluating}
                      onClick={() => executeEvaluation(cvText)}
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        borderRadius: "10px",
                        background: !selectedFile ? "var(--btn-disabled-bg, #9ca3af)" : "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                        border: "none",
                        color: "#fff",
                        cursor: !selectedFile || parsingPdf ? "not-allowed" : "pointer",
                      }}
                    >
                      <Target size={16} />
                      {parsingPdf
                        ? "Reading PDF Content…"
                        : selectedFile
                        ? `Test CV Match Against ${simRole.company} Bar →`
                        : "Upload Resume PDF to Test Match"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                      Paste Resume / Experience Summary:
                    </label>
                    <textarea
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                      placeholder="Paste your resume work history, technical stack, and achievements here..."
                      rows={6}
                      style={{
                        width: "100%",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        padding: "0.75rem",
                        fontSize: "0.85rem",
                        lineHeight: 1.45,
                        fontFamily: "inherit",
                        background: "var(--input-bg, #fff)",
                        color: "var(--text-primary)",
                        marginBottom: "1rem",
                      }}
                    />
                    <button
                      type="button"
                      disabled={evaluating || !cvText.trim()}
                      onClick={() => executeEvaluation(cvText)}
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        fontWeight: 700,
                        borderRadius: "10px",
                      }}
                    >
                      <Target size={16} /> Run AI Bar-Raiser Analysis
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Results Display ──────────────────────────────────────────────── */}
            {!evaluating && matchResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Score & Verdict banner */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.25rem",
                    background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(243, 128, 32, 0.08) 100%)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "1.25rem",
                  }}
                >
                  {/* Score Gauge Circle */}
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      background:
                        matchResult.matchScore >= 80
                          ? "conic-gradient(#16a34a 0% " + matchResult.matchScore + "%, #e5e7eb " + matchResult.matchScore + "% 100%)"
                          : matchResult.matchScore >= 60
                          ? "conic-gradient(#f38020 0% " + matchResult.matchScore + "%, #e5e7eb " + matchResult.matchScore + "% 100%)"
                          : "conic-gradient(#dc2626 0% " + matchResult.matchScore + "%, #e5e7eb " + matchResult.matchScore + "% 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        background: "var(--card-bg, #fff)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {matchResult.matchScore}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      ATS & Bar-Raiser Fit Verdict
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.15rem" }}>
                      {matchResult.verdict}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      Confidence: <strong>{matchResult.confidence}</strong> · Benchmark: {simRole.salary}
                    </div>
                  </div>
                </div>

                {/* Matched Skills */}
                <div>
                  <h4 style={{ margin: "0 0 0.4rem 0", fontSize: "0.88rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <CheckCircle2 size={15} style={{ color: "#16a34a" }} /> Matched Core Signals:
                  </h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {matchResult.matchedSkills.map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          padding: "0.2rem 0.6rem",
                          borderRadius: "9999px",
                          background: "rgba(22, 163, 74, 0.12)",
                          color: "#15803d",
                        }}
                      >
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Keywords / Tech Requirements */}
                {matchResult.missingKeywords.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 0.4rem 0", fontSize: "0.88rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <AlertTriangle size={15} style={{ color: "#f59e0b" }} /> Recommended Keywords to Highlight:
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {matchResult.missingKeywords.map((k) => (
                        <span
                          key={k}
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "9999px",
                            background: "rgba(245, 158, 11, 0.12)",
                            color: "#b45309",
                          }}
                        >
                          + {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Gaps */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ background: "var(--pill-bg, #f4f4f5)", padding: "0.85rem", borderRadius: "10px" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.4rem", color: "#16a34a" }}>
                      Key Strengths
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", lineHeight: 1.45, color: "var(--text-secondary)" }}>
                      {matchResult.strengths.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ background: "var(--pill-bg, #f4f4f5)", padding: "0.85rem", borderRadius: "10px" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.4rem", color: "#c25e00" }}>
                      Resume Improvements
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", lineHeight: 1.45, color: "var(--text-secondary)" }}>
                      {matchResult.resumeGaps.map((rg, i) => (
                        <li key={i}>{rg}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Insider Company Tip */}
                <div
                  style={{
                    background: "rgba(37, 99, 235, 0.06)",
                    border: "1px solid rgba(37, 99, 235, 0.2)",
                    borderRadius: "10px",
                    padding: "0.85rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                  }}
                >
                  <Lightbulb size={18} style={{ color: "#2563eb", flexShrink: 0, marginTop: "0.15rem" }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#2563eb", marginBottom: "0.2rem" }}>
                      {simRole.company} Bar-Raiser Advice
                    </div>
                    <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45, color: "var(--text-primary)" }}>
                      {matchResult.insiderInterviewAdvice}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", paddingTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchResult(null);
                      setSelectedFile(null);
                      setCvText("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Test Another PDF / Resume
                  </button>

                  <a
                    href={simRole.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                  >
                    Apply on {simRole.company} Official Site <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
