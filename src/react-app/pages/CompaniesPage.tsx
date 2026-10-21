import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Building, MapPin, Users, ArrowUpRight, Sparkles, CheckCircle2, Globe } from "lucide-react";
import Seo from "../components/Seo";

interface Company {
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

const CATEGORIES = [
  "All Companies",
  "AI & HR Tech",
  "Cloud & Infrastructure",
  "Developer Tools",
  "Fintech",
  "Productivity & SaaS",
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Companies");

  useEffect(() => {
    fetch("/api/companies")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setCompanies(data as Company[]);
        }
      })
      .catch(() => {
        // Fallback
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.tagline.toLowerCase().includes(search.toLowerCase()) ||
        c.location.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchCategory =
        activeCategory === "All Companies" || c.industry.toLowerCase().includes(activeCategory.toLowerCase().slice(0, 5));

      return matchSearch && matchCategory;
    });
  }, [companies, search, activeCategory]);

  return (
    <div className="cd-page">
      <Seo
        title="Companies Hiring · HireSight"
        description="Explore top technology organizations hiring with AI-powered screening on HireSight."
      />

      {/* Hero Header */}
      <div className="cd-header" style={{ marginBottom: "1.5rem" }}>
        <div style={{ maxWidth: 680 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.75rem", borderRadius: "9999px", background: "var(--pill-purple-bg)", color: "#5b21b6", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            <Sparkles size={13} /> Verified Employer Network
          </div>
          <h1 className="cd-title" style={{ fontSize: "1.85rem", marginBottom: "0.5rem" }}>
            Explore Top Companies
          </h1>
          <p className="cd-subtitle" style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>
            Discover tech organizations actively evaluating talent through HireSight's AI screener. Review company engineering stacks, cultures, and open requisitions.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ position: "relative", minWidth: 280, maxWidth: 360, width: "100%" }}>
          <Search size={16} style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search companies, tech, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "2.4rem", borderRadius: "9999px" }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "1.25rem", scrollbarWidth: "none" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`btn btn-sm ${activeCategory === cat ? "btn-dark-pill" : "btn-secondary"}`}
            onClick={() => setActiveCategory(cat)}
            style={{ borderRadius: "9999px", whiteSpace: "nowrap" }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* MANGO & Trending Spotlight Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #09090b 0%, #1c1917 100%)",
          color: "#fff",
          borderRadius: "14px",
          padding: "1rem 1.35rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.75rem",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.3rem" }}>🔥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff" }}>
              Looking for MANGO & Top-Tier Tech Roles?
            </div>
            <div style={{ fontSize: "0.8rem", color: "#d4d4d8" }}>
              Browse curated openings at Meta, Apple, Netflix, Google, OpenAI, Cloudflare, Stripe with AI Match Simulator.
            </div>
          </div>
        </div>
        <Link
          to="/trending-roles"
          className="btn btn-sm"
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.82rem",
            borderRadius: "9999px",
            border: "none",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.45rem 1rem",
          }}
        >
          Explore MANGO Radar <ArrowUpRight size={14} />
        </Link>
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="cd-jobs-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="cd-job-card" style={{ minHeight: 220, opacity: 0.6 }}>
              <div style={{ height: 40, background: "var(--card-border)", borderRadius: 8, marginBottom: 12 }} />
              <div style={{ height: 20, width: "60%", background: "var(--card-border)", borderRadius: 6, marginBottom: 8 }} />
              <div style={{ height: 16, width: "90%", background: "var(--card-border)", borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="hr-panel" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <Building size={36} style={{ color: "var(--text-muted)", margin: "0 auto 0.75rem auto" }} />
          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>No companies found</h3>
          <p className="hr-muted" style={{ margin: "0 auto 1rem auto", maxWidth: 360, fontSize: "0.85rem" }}>
            Try adjusting your search criteria or switching categories.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSearch(""); setActiveCategory("All Companies"); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="cd-jobs-grid">
          {filtered.map((company) => (
            <div key={company.id} className="cd-job-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                {/* Top: Avatar + Title + Roles Count */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.9rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      className="cd-company-logo"
                      style={{ background: company.color, color: "#fff", fontWeight: 800, fontSize: "1.1rem" }}
                    >
                      {company.initial}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Link
                          to={`/companies/${company.slug}`}
                          style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)", textDecoration: "none" }}
                        >
                          {company.name}
                        </Link>
                        <CheckCircle2 size={14} style={{ color: "var(--status-green)" }} />
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {company.industry}
                      </span>
                    </div>
                  </div>

                  <span
                    className="badge badge-green"
                    style={{ fontSize: "0.74rem", fontWeight: 600, padding: "0.2rem 0.6rem" }}
                  >
                    {company.openRolesCount} open role{company.openRolesCount === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Tagline */}
                <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "0.9rem" }}>
                  {company.tagline}
                </p>

                {/* Meta details */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.9rem", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <MapPin size={12} /> {company.location}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Users size={12} /> {company.size}
                  </span>
                </div>

                {/* Tech Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "1rem" }}>
                  {company.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="cd-tag-pill" style={{ fontSize: "0.72rem" }}>
                      {tag}
                    </span>
                  ))}
                  {company.tags.length > 4 && (
                    <span className="cd-tag-pill" style={{ fontSize: "0.72rem" }}>
                      +{company.tags.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {/* Footer action */}
              <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "0.85rem", marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", textDecoration: "none" }}
                >
                  <Globe size={12} /> Website
                </a>
                <Link
                  to={`/companies/${company.slug}`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                >
                  Explore Roles <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
