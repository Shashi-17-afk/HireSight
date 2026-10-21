import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Building, MapPin, Users, Globe, Calendar, CheckCircle2, ArrowUpRight, Briefcase } from "lucide-react";
import Seo from "../components/Seo";
import { formatDate } from "../lib/hr";

interface CompanyDetail {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  industry: string;
  location: string;
  size: string;
  website: string;
  founded: number;
  tags: string[];
  color: string;
  initial: string;
  openRolesCount: number;
}

interface CompanyJob {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
  applicant_count: number;
}

export default function CompanyDetailPage() {
  const { company_id } = useParams<{ company_id: string }>();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!company_id) return;
    setLoading(true);
    fetch(`/api/companies/${encodeURIComponent(company_id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Company not found");
        return res.json();
      })
      .then((data: unknown) => {
        const json = data as { company?: CompanyDetail; jobs?: CompanyJob[] };
        if (json.company) {
          setCompany(json.company);
          setJobs(json.jobs || []);
        } else {
          setError("Company details not found.");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error loading company");
      })
      .finally(() => setLoading(false));
  }, [company_id]);

  if (loading) {
    return (
      <div className="cd-page" style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <p className="hr-muted">Loading company profile…</p>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="cd-page">
        <Link to="/companies" className="hr-back" style={{ marginBottom: "1rem" }}>
          <ArrowLeft size={14} /> Back to Companies
        </Link>
        <div className="hr-panel" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <Building size={36} style={{ color: "var(--text-muted)", margin: "0 auto 0.75rem auto" }} />
          <h3>{error || "Company not found"}</h3>
          <Link to="/companies" className="btn btn-secondary btn-sm" style={{ marginTop: "1rem" }}>
            Browse All Companies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cd-page">
      <Seo
        title={`${company.name} · Careers & Open Roles`}
        description={company.description}
      />

      <Link to="/companies" className="hr-back" style={{ marginBottom: "1.25rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
        <ArrowLeft size={14} /> Back to Companies
      </Link>

      {/* Hero Card */}
      <div className="hr-panel" style={{ marginBottom: "1.5rem", padding: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
            <div
              className="cd-company-logo"
              style={{
                width: 64,
                height: 64,
                borderRadius: "16px",
                background: company.color,
                color: "#fff",
                fontWeight: 800,
                fontSize: "1.6rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {company.initial}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800 }}>{company.name}</h1>
                <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                  <CheckCircle2 size={12} /> Verified Hiring Employer
                </span>
              </div>
              <p style={{ margin: "4px 0 0.75rem 0", fontSize: "0.95rem", color: "var(--text-secondary)" }}>
                {company.tagline}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", fontSize: "0.82rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Building size={14} /> {company.industry}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <MapPin size={14} /> {company.location}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Users size={14} /> {company.size}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Calendar size={14} /> Founded {company.founded}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <Globe size={14} /> Visit Website <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: Details + Open Requisitions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Left: About & Tech */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="hr-panel">
            <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.05rem" }}>About {company.name}</h3>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {company.description}
            </p>
          </div>

          <div className="hr-panel">
            <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.05rem" }}>Engineering Stack & Ecosystem</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              {company.tags.map((tag) => (
                <span key={tag} className="cd-tag-pill" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="hr-panel">
            <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.05rem" }}>Culture & Hiring Philosophy</h3>
            <ul style={{ paddingLeft: "1.2rem", margin: 0, fontSize: "0.86rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
              <li>Asynchronous & documentation-first team collaboration.</li>
              <li>Meritocratic AI screening evaluated on demonstrated technical skills.</li>
              <li>Competitive compensation, comprehensive healthcare, and flexible PTO.</li>
              <li>Dedicated annual learning, conference, and workstation budget.</li>
            </ul>
          </div>
        </div>

        {/* Right: Active Open Requisitions */}
        <div className="hr-panel">
          <div className="hr-panel-head" style={{ marginBottom: "1rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Active Job Openings</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {jobs.length} position{jobs.length === 1 ? "" : "s"} open for application
              </p>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
              <Briefcase size={28} style={{ margin: "0 auto 0.5rem auto", opacity: 0.6 }} />
              <p style={{ fontSize: "0.88rem" }}>No active openings at this moment.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    background: "var(--bg-subtle, #f9fafb)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "14px",
                    padding: "1.1rem 1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <Link
                      to={`/jobs/${job.id}`}
                      style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}
                    >
                      {job.title}
                    </Link>
                    <div style={{ display: "flex", gap: "0.85rem", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
                      <span>Posted {formatDate(job.created_at)}</span>
                      <span>·</span>
                      <span>{job.applicant_count || 0} applicants</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Link to={`/jobs/${job.id}`} className="btn btn-secondary btn-sm">
                      Details
                    </Link>
                    <Link to={`/apply/${job.id}`} className="btn btn-dark-pill btn-sm">
                      Apply Now <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
