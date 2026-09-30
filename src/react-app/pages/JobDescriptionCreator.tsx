import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Sparkles, RotateCcw, ThumbsUp, ThumbsDown, X } from "lucide-react";
import Seo from "../components/Seo";
import { authHeaders } from "../lib/hr";

interface GeneratedJd {
  jobTitle: string;
  roleSummary: string;
  keyResponsibilities: string[];
  requirements: string[];
  preferredQualifications: string[];
}

const EXPERIENCE = ["0 – 1 Years", "1 – 3 Years", "3 – 5 Years", "5 – 8 Years", "8+ Years"];
const EMPLOYMENT = ["Full-time", "Part-time", "Contract", "Internship"];
const EDUCATION = ["Any", "Bachelor's Degree", "Master's Degree", "PhD"];
const FIELDS = ["Computer Science / IT", "Engineering", "Design", "Business", "Other"];
const WORK_MODES = ["On-site", "Hybrid", "Remote"];

function toDescription(jd: GeneratedJd): string {
  const list = (heading: string, items: string[]) => {
    const bullets = items.map((i) => i.trim()).filter(Boolean);
    return bullets.length ? `${heading}\n${bullets.map((i) => `• ${i}`).join("\n")}` : "";
  };
  return [
    jd.jobTitle.trim(),
    "",
    "Role Summary",
    jd.roleSummary.trim(),
    "",
    list("Key Responsibilities", jd.keyResponsibilities),
    "",
    list("Requirements", jd.requirements),
    "",
    list("Preferred Qualifications", jd.preferredQualifications),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function EditableBullets({
  items,
  onChange,
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="hr-jd-bullets">
      {items.map((item, i) => (
        <div key={i} className="hr-jd-bullet-row">
          <input
            className="form-input"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="hr-icon-btn"
            aria-label="Remove bullet"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {items.length < 10 && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...items, ""])}>
          <Plus size={14} /> Add bullet
        </button>
      )}
    </div>
  );
}

export default function JobDescriptionCreator() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [experience, setExperience] = useState("3 – 5 Years");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [education, setEducation] = useState("Bachelor's Degree");
  const [fieldOfStudy, setFieldOfStudy] = useState("Computer Science / IT");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("Hybrid");
  const [languageInput, setLanguageInput] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [nationality, setNationality] = useState("Any");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [otherRequirements, setOtherRequirements] = useState("");

  const [generated, setGenerated] = useState<GeneratedJd | null>(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const canGenerate = title.trim().length > 0;
  const canPublish =
    Boolean(generated?.jobTitle.trim()) &&
    Boolean(generated?.roleSummary.trim()) &&
    (generated?.keyResponsibilities.some((i) => i.trim()) ?? false) &&
    (generated?.requirements.some((i) => i.trim()) ?? false);

  const payload = useMemo(
    () => ({
      title: title.trim(),
      department: department.trim() || undefined,
      experience,
      employmentType,
      education,
      fieldOfStudy,
      location: location.trim() || undefined,
      workMode,
      languages,
      nationality,
      skills,
      otherRequirements: otherRequirements.trim() || undefined,
    }),
    [title, department, experience, employmentType, education, fieldOfStudy, location, workMode, languages, nationality, skills, otherRequirements]
  );

  function addChip(value: string, list: string[], setList: (next: string[]) => void, setInput: (v: string) => void) {
    const next = value.trim();
    if (!next || list.includes(next)) return;
    setList([...list, next]);
    setInput("");
  }

  function patchGenerated(partial: Partial<GeneratedJd>) {
    setGenerated((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  async function generate() {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setError("");
    setFeedback(null);
    try {
      const res = await fetch("/api/jobs/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as GeneratedJd & { error?: string; retryAfter?: number };
      if (res.status === 429) {
        throw new Error(`Too many generations. Try again in ${data.retryAfter ?? 60}s.`);
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to generate job description");
      setGenerated({
        jobTitle: data.jobTitle || title.trim(),
        roleSummary: data.roleSummary,
        keyResponsibilities: data.keyResponsibilities ?? [],
        requirements: data.requirements ?? [],
        preferredQualifications: data.preferredQualifications ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function publish() {
    if (!generated || !canPublish) return;
    setPublishing(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: generated.jobTitle.trim() || title.trim(),
          description: toDescription(generated),
        }),
      });
      const data = (await res.json()) as { job_id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create job");
      navigate(data.job_id ? `/dashboard/${data.job_id}` : "/hr/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    setTitle("");
    setDepartment("");
    setExperience("3 – 5 Years");
    setEmploymentType("Full-time");
    setEducation("Bachelor's Degree");
    setFieldOfStudy("Computer Science / IT");
    setLocation("");
    setWorkMode("Hybrid");
    setLanguages(["English"]);
    setNationality("Any");
    setSkills([]);
    setOtherRequirements("");
    setGenerated(null);
    setError("");
    setFeedback(null);
  }

  const generateLabel = generating
    ? generated
      ? "Regenerating…"
      : "Generating…"
    : generated
      ? "Regenerate"
      : "Generate with AI";

  return (
    <div className="hr-page">
      <Seo title="AI Job Description Creator" description="Fill role information and let AI generate a professional job description." noIndex />

      <Link to="/hr/jobs" className="hr-back">
        <ArrowLeft size={14} /> Back to Job Requisitions
      </Link>

      <div className="hr-page-head">
        <div>
          <h1>AI Job Description Creator</h1>
          <p>Enter role requirements and let AI generate a professional job description.</p>
        </div>
        <div className="hr-page-actions">
          <button type="button" className="btn btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> Reset
          </button>
          <button type="button" className="btn btn-dark-pill" disabled={!canGenerate || generating} onClick={() => void generate()}>
            <Sparkles size={14} /> {generateLabel}
          </button>
        </div>
      </div>

      {error && <div className="hr-banner-error">{error}</div>}

      <div className="hr-jd-grid">
        <div className="hr-panel">
          <div className="hr-panel-head">
            <span className="hr-step">1</span>
            <div>
              <h3>Role Information</h3>
              <p>Fill in the form below to generate your job description</p>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="label">Job Title *</label>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Frontend Developer" required />
            </div>
            <div className="form-group">
              <label className="label">Department</label>
              <input className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
            </div>
            <div className="form-group">
              <label className="label">Experience (Years) *</label>
              <select className="form-input" value={experience} onChange={(e) => setExperience(e.target.value)}>
                {EXPERIENCE.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Employment Type *</label>
              <select className="form-input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                {EMPLOYMENT.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Education Level *</label>
              <select className="form-input" value={education} onChange={(e) => setEducation(e.target.value)}>
                {EDUCATION.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Field of Study</label>
              <select className="form-input" value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)}>
                {FIELDS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Location</label>
              <input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru, India" />
            </div>
            <div className="form-group">
              <label className="label">Work Mode</label>
              <select className="form-input" value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
                {WORK_MODES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Languages Required</label>
            <div className="hr-chips">
              {languages.map((lang) => (
                <button type="button" key={lang} className="hr-chip" onClick={() => setLanguages(languages.filter((l) => l !== lang))}>
                  {lang} ×
                </button>
              ))}
              <input
                className="hr-chip-input"
                value={languageInput}
                placeholder="+ add language"
                onChange={(e) => setLanguageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip(languageInput, languages, setLanguages, setLanguageInput);
                  }
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Nationality Preference</label>
            <input className="form-input" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Key Skills</label>
            <div className="hr-chips">
              {skills.map((skill) => (
                <button type="button" key={skill} className="hr-chip" onClick={() => setSkills(skills.filter((s) => s !== skill))}>
                  {skill} ×
                </button>
              ))}
              <input
                className="hr-chip-input"
                value={skillInput}
                placeholder="Type a skill and press Enter"
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip(skillInput, skills, setSkills, setSkillInput);
                  }
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Other Requirements (Optional)</label>
            <textarea
              className="form-input"
              rows={3}
              value={otherRequirements}
              onChange={(e) => setOtherRequirements(e.target.value)}
              placeholder="e.g. Certifications, soft skills, tools, etc."
            />
          </div>

          <p className="hr-hint">
            <Sparkles size={14} /> AI will use this information to generate a comprehensive job description including responsibilities, requirements and qualifications.
          </p>

          <div className="hr-form-footer">
            <Link to="/hr/jobs" className="btn btn-secondary">Cancel</Link>
            <button type="button" className="btn btn-dark-pill" disabled={!canGenerate || generating} onClick={() => void generate()}>
              <Sparkles size={14} /> {generateLabel}
            </button>
          </div>
        </div>

        <div className={`hr-panel hr-jd-preview${generating ? " is-loading" : ""}`}>
          <div className="hr-panel-head">
            <h3>AI Generated Job Description</h3>
            {generated && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={!canGenerate || generating} onClick={() => void generate()}>
                <Sparkles size={14} /> {generating ? "Regenerating…" : "Regenerate"}
              </button>
            )}
          </div>

          {generating && (
            <div className="hr-jd-loading" role="status">
              {generated ? "Regenerating draft…" : "Drafting job description…"}
            </div>
          )}

          {!generated ? (
            <div className="hr-jd-placeholder">
              <h4>Click “Generate with AI” to draft a JD</h4>
              <p>Fill in the role information on the left, then press Generate with AI. You can edit the draft before publishing.</p>
              <div className="hr-jd-skel">
                <strong>Role Summary</strong>
                <em>(waiting AI output)</em>
                <strong>Key Responsibilities</strong>
                <em>(waiting AI output)</em>
                <strong>Requirements</strong>
                <em>(waiting AI output)</em>
                <strong>Preferred Qualifications</strong>
                <em>(waiting AI output)</em>
              </div>
            </div>
          ) : (
            <div className="hr-jd-body">
              <label className="label">Job Title</label>
              <input
                className="form-input"
                value={generated.jobTitle}
                onChange={(e) => patchGenerated({ jobTitle: e.target.value })}
              />
              <label className="label">Role Summary</label>
              <textarea
                className="form-input"
                rows={4}
                value={generated.roleSummary}
                onChange={(e) => patchGenerated({ roleSummary: e.target.value })}
              />
              <label className="label">Key Responsibilities</label>
              <EditableBullets
                items={generated.keyResponsibilities}
                onChange={(keyResponsibilities) => patchGenerated({ keyResponsibilities })}
              />
              <label className="label">Requirements</label>
              <EditableBullets
                items={generated.requirements}
                onChange={(requirements) => patchGenerated({ requirements })}
              />
              <label className="label">Preferred Qualifications</label>
              <EditableBullets
                items={generated.preferredQualifications}
                onChange={(preferredQualifications) => patchGenerated({ preferredQualifications })}
              />
            </div>
          )}

          <div className="hr-jd-footer">
            <span>Was this helpful?</span>
            <button type="button" className={`hr-icon-btn${feedback === "up" ? " is-on" : ""}`} onClick={() => setFeedback("up")} aria-label="Helpful">
              <ThumbsUp size={14} />
            </button>
            <button type="button" className={`hr-icon-btn${feedback === "down" ? " is-on" : ""}`} onClick={() => setFeedback("down")} aria-label="Not helpful">
              <ThumbsDown size={14} />
            </button>
            <span className="hr-spacer" />
            <button type="button" className="btn btn-dark-pill" disabled={!canPublish || publishing || generating} onClick={() => void publish()}>
              {publishing ? "Publishing…" : "Use This Description"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
