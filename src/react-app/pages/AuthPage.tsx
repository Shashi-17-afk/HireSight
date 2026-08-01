import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo";


interface AuthPageProps {
  mode: "login" | "register";
  role: "hr" | "candidate";
}

export default function AuthPage({ mode, role }: AuthPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isHr = role === "hr";
  const isRegister = mode === "register";

  const title = `${isHr ? "Recruiter" : "Candidate"} ${
    isRegister ? "Registration" : "Sign In"
  }`;
  
  const sub = isRegister
    ? `Create your account to start ${isHr ? "screening applicants with AI" : "applying & tracking roles"}.`
    : `Welcome back! Enter your credentials to access your dashboard.`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload: Record<string, string> = {
      email: email.trim(),
      password: password.trim(),
    };

    if (isRegister) {
      payload.name = name.trim();
      if (isHr && companyName.trim()) {
        payload.company_name = companyName.trim();
      }
    }

    const endpoint = `/api/auth/${mode}/${role}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        token?: string;
        role?: string;
        name?: string;
        userId?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Authentication failed");
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role ?? "");
        localStorage.setItem("name", data.name ?? "");
        localStorage.setItem("userId", data.userId ?? "");
        localStorage.setItem("email", email.trim().toLowerCase());
        
        window.dispatchEvent(new Event("storage"));

        if (redirectTo && data.role === "candidate") {
          navigate(redirectTo);
        } else if (data.role === "HR") {
          navigate("/hr/dashboard");
        } else {
          navigate("/candidate/dashboard");
        }
      } else {
        throw new Error("No token received");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const seoTitle = isRegister
    ? isHr ? "Create Recruiter Account" : "Join HireSight — Candidate Sign Up"
    : isHr ? "Recruiter Sign In" : "Candidate Sign In";

  return (
    <div className="page" style={{ maxWidth: "480px", paddingTop: "2.5rem" }}>
      <Seo title={seoTitle} noIndex />

      {/* Role Toggle Header */}
      <div style={{ display: "flex", background: "var(--card-bg-alt)", padding: "0.3rem", borderRadius: "var(--radius-full)", marginBottom: "2rem", border: "1px solid var(--card-border)" }}>
        <Link
          to={`/${mode}/hr${redirectTo ? `?redirect=${redirectTo}` : ""}`}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "0.6rem 1rem",
            borderRadius: "var(--radius-full)",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.9rem",
            background: isHr ? "var(--brand)" : "transparent",
            color: isHr ? "var(--text-inverse)" : "var(--text-secondary)",
            transition: "all 0.2s ease"
          }}
        >
          Recruiter Portal
        </Link>
        <Link
          to={`/${mode}/candidate${redirectTo ? `?redirect=${redirectTo}` : ""}`}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "0.6rem 1rem",
            borderRadius: "var(--radius-full)",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.9rem",
            background: !isHr ? "var(--brand)" : "transparent",
            color: !isHr ? "var(--text-inverse)" : "var(--text-secondary)",
            transition: "all 0.2s ease"
          }}
        >
          Candidate Portal
        </Link>
      </div>

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
          {title.split(" ")[0]} <span className="pill-highlight pill-pink">{title.split(" ").slice(1).join(" ")}</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.98rem" }}>{sub}</p>
      </div>

      <div className="card">
        <form onSubmit={(e) => void handleSubmit(e)}>
          {isRegister && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Full Name
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          {isRegister && isHr && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Company Name (Optional)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
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

          <div style={{ marginBottom: "1.75rem" }}>
            <label style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              Password
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ color: "var(--status-red)", fontSize: "0.88rem", marginBottom: "1rem", fontWeight: 600 }}>
              ⚠ {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-dark-pill btn-lg"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? "Processing..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid var(--card-border)", textAlign: "center", fontSize: "0.9rem" }}>
          {isRegister ? (
            <p style={{ color: "var(--text-secondary)" }}>
              Already have an account?{" "}
              <Link to={`/login/${role}${redirectTo ? `?redirect=${redirectTo}` : ""}`} style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                Sign in
              </Link>
            </p>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>
              Don't have an account?{" "}
              <Link to={`/register/${role}${redirectTo ? `?redirect=${redirectTo}` : ""}`} style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                Register now
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
