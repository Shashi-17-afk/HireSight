import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Bookmark,
  MapPin,
  Users,
  ChevronDown,
  FileText,
  Sparkles,
  Check,
  ArrowUpRight,
  Briefcase,
} from "lucide-react";
import Seo from "../components/Seo";
import CustomSelect, { CustomSelectOption } from "../components/CustomSelect";
import { authHeaders, STATUS_LABEL, timeAgo } from "../lib/hr";

interface OpenJob {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
  applicant_count: number;
}

interface Application {
  id: string;
  application_id: string | null;
  job_id: string;
  job_title: string;
  score: number;
  reasoning: string;
  created_at: string;
  status: string | null;
}

function stageOf(app: Application): string {
  return app.status || "applied";
}

const STAGE_COLORS: Record<string, string> = {
  applied: "#3b82f6",
  under_review: "#f59e0b",
  shortlisted: "#8b5cf6",
  interview: "#10b981",
  hired: "#10b981",
  rejected: "#ef4444",
};

// Deterministic company details and tags from job ID and title
function getCompanyMeta(_title: string, id: string) {
  const seed = (id.charCodeAt(0) || 0) + (id.charCodeAt(id.length - 1) || 0) + (id.charCodeAt(Math.floor(id.length / 2)) || 0);
  const companies = [
    { name: "Epic Games", color: "#1a1a2e", initial: "EG", location: "Remote" },
    { name: "Linear", color: "#5e6ad2", initial: "LN", location: "San Francisco, CA" },
    { name: "Figma", color: "#f24e1e", initial: "FG", location: "New York, NY" },
    { name: "Vercel", color: "#000000", initial: "VC", location: "Remote" },
    { name: "Stripe", color: "#635bff", initial: "SP", location: "San Francisco, CA" },
    { name: "Raycast", color: "#ff6363", initial: "RC", location: "London, UK" },
    { name: "OpenAI", color: "#10a37f", initial: "OA", location: "San Francisco, CA" },
    { name: "Retool", color: "#3d5afe", initial: "RT", location: "Remote" },
  ];
  const company = companies[seed % companies.length];

  const tagOptions = [
    ["Full Time", "Remote", "Engineering"],
    ["Full Time", "In Office", "Dev"],
    ["Contract", "Remote", "Backend"],
    ["Full Time", "Hybrid", "Frontend"],
    ["Full Time", "Remote", "Design"],
  ];
  const tags = tagOptions[seed % tagOptions.length];

  const salaries = ["$120/hr", "$95/hr", "$140/hr", "$110/hr", "$85/hr", "$130/hr", "$150/hr"];
  const salary = salaries[seed % salaries.length];

  return { company, tags, salary };
}

// Dropdown options
const EXP_LEVEL_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All Experience Levels", sublabel: "Any seniority" },
  { value: "junior", label: "Junior Level", sublabel: "0–2 years experience", badge: "0-2 yrs" },
  { value: "mid", label: "Mid Level", sublabel: "3–5 years experience", badge: "3-5 yrs" },
  { value: "senior", label: "Senior Level", sublabel: "5–8 years experience", badge: "5-8 yrs" },
  { value: "lead", label: "Lead / Principal", sublabel: "8+ years experience", badge: "8+ yrs" },
];

const JOB_TYPE_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All Job Types", sublabel: "Any employment contract" },
  { value: "fulltime", label: "Full Time", sublabel: "Permanent full-time role", badge: "Full-Time" },
  { value: "parttime", label: "Part Time", sublabel: "Flexible 20h/wk", badge: "Part-Time" },
  { value: "contract", label: "Contract", sublabel: "Fixed-duration project", badge: "Contract" },
  { value: "freelance", label: "Freelance", sublabel: "Independent contractor", badge: "Freelance" },
  { value: "remote", label: "Remote Only", sublabel: "100% remote friendly", badge: "Remote" },
];

const INDUSTRY_OPTIONS: CustomSelectOption[] = [
  { value: "Media & Design", label: "Media & Design", sublabel: "UI/UX, Creative, Motion" },
  { value: "Technology", label: "Technology & Software", sublabel: "AI, Cloud, SaaS, Dev" },
  { value: "Finance", label: "Finance & Fintech", sublabel: "Banking, Crypto, Risk" },
  { value: "Healthcare", label: "Healthcare & Biotech", sublabel: "Healthtech, MedTech" },
  { value: "Ecommerce", label: "E-Commerce & Retail", sublabel: "Marketplaces, D2C" },
];

const SCHEDULE_OPTIONS: CustomSelectOption[] = [
  { value: "Flexible Hours", label: "Flexible Hours", sublabel: "Async self-managed hours" },
  { value: "Standard", label: "Standard (9 to 5)", sublabel: "Regular office hours" },
  { value: "Shift Based", label: "Shift Based", sublabel: "Day & night rotation" },
  { value: "Hybrid", label: "Hybrid Schedule", sublabel: "2–3 days in office" },
];

const POPULAR_LOCATIONS = [
  { label: "Remote", sublabel: "Work from anywhere in the world" },
  { label: "New York, NY", sublabel: "United States (EST)" },
  { label: "San Francisco, CA", sublabel: "United States (PST)" },
  { label: "London, UK", sublabel: "United Kingdom (GMT)" },
  { label: "Berlin, Germany", sublabel: "Europe (CET)" },
  { label: "Bengaluru, India", sublabel: "India (IST)" },
];

// Clean Card for an Open Role
function OpenJobCard({
  job,
  featured,
  saved,
  onToggleSave,
  hasApplied,
}: {
  job: OpenJob;
  featured?: boolean;
  saved: boolean;
  onToggleSave: () => void;
  hasApplied: boolean;
}) {
  const meta = useMemo(() => getCompanyMeta(job.title, job.id), [job.title, job.id]);

  return (
    <div className={`cd-job-card${featured ? " cd-job-card--featured" : ""}`}>
      {/* Top: Tags + Bookmark */}
      <div className="cd-card-top">
        <div className="cd-tag-list">
          {meta.tags.map((t) => (
            <span key={t} className="cd-tag-pill">{t}</span>
          ))}
        </div>
        <button
          type="button"
          className={`cd-bookmark-btn${saved ? " active" : ""}`}
          onClick={onToggleSave}
          aria-label={saved ? "Remove bookmark" : "Save job"}
        >
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Middle: Company logo + Title */}
      <div className="cd-card-company-row">
        <div
          className="cd-company-logo"
          style={{ background: featured ? "#262738" : meta.company.color }}
        >
          {meta.company.initial}
        </div>
        <div className="cd-card-title-group">
          <span className="cd-company-name">{meta.company.name}</span>
          <Link
            to={`/jobs/${job.id}`}
            className="cd-job-title"
            title={job.title}
            style={{ textDecoration: "none" }}
          >
            {job.title}
          </Link>
        </div>
      </div>

      {/* Meta: Salary + Applicants */}
      <div className="cd-card-meta-row">
        <span className="cd-salary">{meta.salary}</span>
        <span className="cd-applicants">
          <Users size={13} /> {job.applicant_count || 0} applied
        </span>
      </div>

      {/* Footer: Apply Action + Date */}
      <div className="cd-card-footer">
        {hasApplied ? (
          <span className="cd-applied-badge">
            <Check size={13} strokeWidth={2.5} /> Applied
          </span>
        ) : (
          <Link to={`/apply/${job.id}`} className="cd-apply-btn">
            Apply Now <ArrowUpRight size={13} />
          </Link>
        )}
        <span className="cd-time-ago">{timeAgo(job.created_at)}</span>
      </div>
    </div>
  );
}

// Clean Card for an Applied Application
function ApplicationCard({
  app,
  featured,
  saved,
  onToggleSave,
  flash,
}: {
  app: Application;
  featured?: boolean;
  saved: boolean;
  onToggleSave: () => void;
  flash: boolean;
}) {
  const meta = useMemo(() => getCompanyMeta(app.job_title, app.id), [app.job_title, app.id]);
  const stage = stageOf(app);
  const stageLabel = STATUS_LABEL[stage] || stage.replace(/_/g, " ");

  return (
    <div className={`cd-job-card${featured ? " cd-job-card--featured" : ""}${flash ? " cd-flash" : ""}`}>
      {/* Top: Tags + Bookmark */}
      <div className="cd-card-top">
        <div className="cd-tag-list">
          {meta.tags.map((t) => (
            <span key={t} className="cd-tag-pill">{t}</span>
          ))}
          {app.score >= 80 && (
            <span className="cd-tag-pill cd-tag-pill--match">
              <Sparkles size={10} /> {app.score}% Match
            </span>
          )}
        </div>
        <button
          type="button"
          className={`cd-bookmark-btn${saved ? " active" : ""}`}
          onClick={onToggleSave}
          aria-label={saved ? "Remove bookmark" : "Save job"}
        >
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Middle: Company logo + Title */}
      <div className="cd-card-company-row">
        <div
          className="cd-company-logo"
          style={{ background: featured ? "#262738" : meta.company.color }}
        >
          {meta.company.initial}
        </div>
        <div className="cd-card-title-group">
          <span className="cd-company-name">{meta.company.name}</span>
          <Link
            to={`/jobs/${app.job_id}`}
            className="cd-job-title"
            title={app.job_title}
            style={{ textDecoration: "none" }}
          >
            {app.job_title}
          </Link>
        </div>
      </div>

      {/* Meta: Salary + Applicants */}
      <div className="cd-card-meta-row">
        <span className="cd-salary">{meta.salary}</span>
        <span className="cd-applicants">
          <Users size={13} /> Applied Role
        </span>
      </div>

      {/* Footer: Status Pill + Date */}
      <div className="cd-card-footer">
        <span
          className="cd-stage-pill"
          style={{
            borderColor: STAGE_COLORS[stage] || "var(--card-border)",
            color: STAGE_COLORS[stage] || "var(--text-secondary)",
          }}
        >
          {stageLabel}
        </span>
        <span className="cd-time-ago">{timeAgo(app.created_at)}</span>
      </div>
    </div>
  );
}

export default function CandidateDashboard() {
  const [openJobs, setOpenJobs] = useState<OpenJob[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeTab, setActiveTab] = useState<"open" | "applied">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Search & Filter state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  const [expLevel, setExpLevel] = useState("");
  const [jobType, setJobType] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("Media & Design");
  const [selectedSchedule, setSelectedSchedule] = useState("Flexible Hours");

  const [cvDragOver, setCvDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem("token") ?? "";
  const name = localStorage.getItem("name") ?? "Candidate";
  const firstName = name.split(" ")[0];
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Click outside listener for location popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setLocationOpen(false);
      }
    }
    if (locationOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [locationOpen]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch top open roles
      const jobsPromise = fetch("/api/jobs")
        .then((res) => (res.ok ? (res.json() as Promise<{ jobs: OpenJob[] }>) : { jobs: [] }))
        .then((data) => data.jobs || []);

      // 2. Fetch candidate applications (if authenticated)
      const appsPromise = token
        ? fetch("/api/candidates/my-applications", { headers: authHeaders() })
            .then((res) => (res.ok ? (res.json() as Promise<Application[]>) : []))
            .catch(() => [] as Application[])
        : Promise.resolve([] as Application[]);

      const [jobsData, appsData] = await Promise.all([jobsPromise, appsPromise]);
      setOpenJobs(jobsData);
      setApplications(appsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  // Real-time status WebSocket
  useEffect(() => {
    if (!token) return;
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${window.location.host}/api/status/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; job_id: string; to_status: string };
          if (msg.type === "status_update") {
            setApplications((prev) => prev.map((app) => (app.job_id === msg.job_id ? { ...app, status: msg.to_status } : app)));
            setFlashIds((ids) => {
              const next = new Set(ids);
              next.add(msg.job_id);
              setTimeout(() => {
                setFlashIds((s) => {
                  const n = new Set(s);
                  n.delete(msg.job_id);
                  return n;
                });
              }, 2500);
              return next;
            });
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { reconnectTimer.current = setTimeout(connect, 4000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [token]);

  // Applied job IDs set for fast check
  const appliedJobIds = useMemo(() => {
    return new Set(applications.map((a) => a.job_id));
  }, [applications]);

  const stats = useMemo(() => {
    const scores = applications.map((a) => a.score).filter((n) => typeof n === "number");
    const avg = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null;
    const cvScore = avg !== null ? Math.min(100, Math.round(avg * 0.9 + 5)) : 88;
    const interviewPrep = avg !== null ? Math.min(100, Math.round(avg * 0.65 + 15)) : 75;
    return { cvScore, interviewPrep, openCount: openJobs.length };
  }, [applications, openJobs]);

  // Filter open jobs
  const filteredOpenJobs = useMemo(() => {
    return openJobs.filter((job) => {
      if (searchKeyword && !job.title.toLowerCase().includes(searchKeyword.toLowerCase()) && !job.description.toLowerCase().includes(searchKeyword.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [openJobs, searchKeyword]);

  // Filter applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (searchKeyword && !app.job_title.toLowerCase().includes(searchKeyword.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [applications, searchKeyword]);

  function toggleSave(id: string) {
    setSavedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div className="cd-root">
      <Seo title="My Dashboard — HireSight" description="Explore top open roles and track your active job applications." noIndex />

      {/* ── Welcome Header ─────────────────────────────── */}
      <div className="cd-welcome">
        <h1 className="cd-welcome-title">Welcome back, {firstName}</h1>
        <div className="cd-welcome-meta">
          {loading ? (
            <span className="cd-meta-chip">Loading live openings…</span>
          ) : (
            <>
              {stats.openCount > 0 && (
                <span className="cd-meta-chip">
                  {stats.openCount} open positions actively hiring today
                </span>
              )}
              <span className="cd-meta-chip cd-meta-sep">
                CV Score: {stats.cvScore}/100
              </span>
              <span className="cd-meta-chip cd-meta-sep">
                Interview Preparedness: {stats.interviewPrep}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Search Bar ─────────────────────────────────── */}
      <div className="cd-search-bar">
        <div className="cd-search-field cd-search-keyword">
          <label>Job Title / Keywords</label>
          <input
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="e.g. Frontend Developer, Backend, Designer"
            onKeyDown={(e) => e.key === "Enter" && loadData()}
          />
        </div>

        <div className="cd-search-divider" />

        {/* Location with Quick Suggestions Popover */}
        <div className="cd-search-field" ref={locationRef}>
          <label>Location</label>
          <div
            className="cd-search-select-wrap"
            onClick={() => setLocationOpen((prev) => !prev)}
          >
            <input
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              onFocus={() => setLocationOpen(true)}
              placeholder="e.g. Remote, San Francisco, London"
            />
            <ChevronDown
              size={13}
              className={`cd-chevron ${locationOpen ? "c-select-chevron-rotate" : ""}`}
            />
          </div>

          {locationOpen && (
            <div className="cd-location-popover">
              <div className="cd-location-popover-title">Popular Locations</div>
              <div className="c-select-options-list">
                {POPULAR_LOCATIONS.map((loc) => {
                  const isSelected = searchLocation.toLowerCase() === loc.label.toLowerCase();
                  return (
                    <div
                      key={loc.label}
                      className={`c-select-option ${isSelected ? "c-select-option-selected" : ""}`}
                      onClick={() => {
                        setSearchLocation(loc.label);
                        setLocationOpen(false);
                      }}
                    >
                      <div className="c-select-opt-left">
                        <MapPin size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <div className="c-select-opt-text">
                          <span className="c-select-opt-label">{loc.label}</span>
                          <span className="c-select-opt-sublabel">{loc.sublabel}</span>
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="c-select-check" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="cd-search-divider" />

        {/* Experience Level Modern Dropdown */}
        <div className="cd-search-field">
          <CustomSelect
            label="Experience Level"
            value={expLevel}
            onChange={(val) => setExpLevel(val)}
            options={EXP_LEVEL_OPTIONS}
            placeholder="Select Experience Level"
            variant="search"
          />
        </div>

        <div className="cd-search-divider" />

        {/* Job Type Modern Dropdown */}
        <div className="cd-search-field">
          <CustomSelect
            label="Job Type"
            value={jobType}
            onChange={(val) => setJobType(val)}
            options={JOB_TYPE_OPTIONS}
            placeholder="Select Job Type"
            variant="search"
          />
        </div>

        <button type="button" className="cd-search-btn" onClick={loadData}>
          <Search size={15} />
          Search
        </button>
      </div>

      {error && (
        <div className="hr-banner-error">
          {error}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>Try again</button>
        </div>
      )}

      {/* ── Main Body ──────────────────────────────────── */}
      <div className="cd-body">

        {/* ── Left Filter Panel ───────────────────────── */}
        <aside className="cd-filters">
          {/* AI CV Upload */}
          <div className="cd-cv-upload-card">
            <h4>Let AI find your ideal job</h4>
            <p>Upload your CV and get matched instantly</p>
            <div
              className={`cd-dropzone${cvDragOver ? " drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setCvDragOver(true); }}
              onDragLeave={() => setCvDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setCvDragOver(false); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={26} strokeWidth={1.3} />
              <span>Click and paste anywhere in this box.</span>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} />
            </div>
            <button type="button" className="cd-get-matched-btn">
              <Sparkles size={13} /> Get Matched
            </button>
          </div>

          {/* Company / Industry Modern Dropdown */}
          <div className="cd-filter-section">
            <h5>Company / Industry</h5>
            <CustomSelect
              value={selectedIndustry}
              onChange={(val) => setSelectedIndustry(val)}
              options={INDUSTRY_OPTIONS}
              placeholder="Select Industry"
              variant="filter"
            />
          </div>

          {/* Work Schedule Modern Dropdown */}
          <div className="cd-filter-section">
            <h5>Work Schedule</h5>
            <CustomSelect
              value={selectedSchedule}
              onChange={(val) => setSelectedSchedule(val)}
              options={SCHEDULE_OPTIONS}
              placeholder="Select Schedule"
              variant="filter"
            />
          </div>

          {/* Salary Range */}
          <div className="cd-filter-section">
            <h5>Salary Range</h5>
            <div className="cd-salary-row">
              <label>Yearly</label>
            </div>
            <input type="range" min={30000} max={250000} step={5000} className="cd-range-slider" defaultValue={150000} />
            <div className="cd-salary-labels">
              <span>$35K</span>
              <span>$150K</span>
            </div>
          </div>

          {/* Job Type Checkboxes */}
          <div className="cd-filter-section">
            <h5>Employment Type</h5>
            <div className="cd-checkbox-group">
              {["Full Time", "Part Time", "Contract", "Freelance", "Remote"].map((t) => (
                <label key={t} className="cd-checkbox-label">
                  <input type="checkbox" />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Job Cards Grid ───────────────────────────── */}
        <main className="cd-jobs-area">
          {/* Header Row: Title & Tabs */}
          <div className="cd-jobs-header-row">
            <div className="cd-jobs-heading-group">
              <h2 className="cd-jobs-title">
                {activeTab === "open" ? "Top Open Roles" : "My Applications"}
              </h2>
              <span className="cd-jobs-count-badge">
                {activeTab === "open" ? `${filteredOpenJobs.length} available` : `${filteredApplications.length} applied`}
              </span>
            </div>

            <div className="cd-jobs-view-tabs">
              <button
                type="button"
                className={`cd-view-tab ${activeTab === "open" ? "active" : ""}`}
                onClick={() => setActiveTab("open")}
              >
                Top Open Roles ({openJobs.length})
              </button>
              <button
                type="button"
                className={`cd-view-tab ${activeTab === "applied" ? "active" : ""}`}
                onClick={() => setActiveTab("applied")}
              >
                My Applications ({applications.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="cd-loading-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="cd-job-card cd-job-card--skeleton">
                  <div className="cd-skeleton-logo" />
                  <div className="cd-skeleton-line w60" />
                  <div className="cd-skeleton-line w80" />
                  <div className="cd-skeleton-line w40" />
                </div>
              ))}
            </div>
          ) : activeTab === "open" ? (
            filteredOpenJobs.length === 0 ? (
              <div className="cd-empty-state">
                <Briefcase size={44} strokeWidth={1.3} />
                <h3>No open roles found</h3>
                <p>Try clearing your keyword filters or check back shortly for new requisitions.</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSearchKeyword(""); loadData(); }}>
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="cd-jobs-grid">
                {filteredOpenJobs.map((job, idx) => (
                  <OpenJobCard
                    key={job.id}
                    job={job}
                    featured={idx === 1} /* second card is featured dark style */
                    saved={savedIds.has(job.id)}
                    onToggleSave={() => toggleSave(job.id)}
                    hasApplied={appliedJobIds.has(job.id)}
                  />
                ))}
              </div>
            )
          ) : (
            filteredApplications.length === 0 ? (
              <div className="cd-empty-state">
                <FileText size={44} strokeWidth={1.3} />
                <h3>No applications yet</h3>
                <p>Explore the top open roles above and apply to start tracking your AI evaluation stages.</p>
                <button type="button" className="btn btn-dark-pill btn-sm" onClick={() => setActiveTab("open")}>
                  Browse Open Roles
                </button>
              </div>
            ) : (
              <div className="cd-jobs-grid">
                {filteredApplications.map((app, idx) => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    featured={idx === 1}
                    saved={savedIds.has(app.id)}
                    onToggleSave={() => toggleSave(app.id)}
                    flash={flashIds.has(app.job_id)}
                  />
                ))}
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}
