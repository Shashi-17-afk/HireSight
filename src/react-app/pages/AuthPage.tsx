import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

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

  const title = `${isHr ? "HR / Recruiter" : "Candidate"} ${
    isRegister ? "Registration" : "Sign In"
  }`;
  
  const sub = isRegister
    ? `Create your account to start ${isHr ? "screening applicants" : "tracking applications"}.`
    : `Welcome back! Please enter your details to access the dashboard.`;

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
        
        // Dispatch custom storage event so App navbar can update instantly
        window.dispatchEvent(new Event("storage"));

        // Redirect: honour ?redirect= param (candidates only), else go to dashboard
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

  return (
    <div className="page">
      <div className="hero" style={{ padding: "2rem 1rem 1.5rem" }}>
        <h1 style={{ fontSize: "2.2rem" }}>
          {isRegister ? "Join " : "Access "}
          <span>HireSight</span>
        </h1>
        <p style={{ maxWidth: 440, fontSize: ".95rem", margin: ".5rem auto 1.5rem" }}>{sub}</p>
      </div>

      <div className="card" style={{ maxWidth: 460, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            marginBottom: "1.5rem",
            letterSpacing: "-.02em",
            textAlign: "center",
          }}
        >
          {title}
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {isRegister && (
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
          )}

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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {isRegister && isHr && (
            <div className="form-group">
              <label htmlFor="company">Company Name (Optional)</label>
              <input
                id="company"
                type="text"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          )}

          {error && <p className="error-text" style={{ marginBottom: "1rem" }}>⚠ {error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: ".5rem" }}
          >
            {loading ? (
              <>
                <span className="spinner" /> Working…
              </>
            ) : isRegister ? (
              "Create Account →"
            ) : (
              "Sign In →"
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: "1.5rem",
            textAlign: "center",
            fontSize: ".83rem",
            color: "var(--text-secondary)",
          }}
        >
          {isRegister ? (
            <>
              Already have an account?{" "}
              <Link to={`/login/${role}`} style={{ fontWeight: 600 }}>
                Sign In
              </Link>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <Link to={`/register/${role}`} style={{ fontWeight: 600 }}>
                Register
              </Link>
            </>
          )}
        </div>

        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--card-border)",
            textAlign: "center",
            fontSize: ".83rem",
          }}
        >
          Switch to{" "}
          <Link
            to={isRegister ? `/register/${isHr ? "candidate" : "hr"}` : `/login/${isHr ? "candidate" : "hr"}`}
            style={{ fontWeight: 600, color: "var(--brand-light)" }}
          >
            {isHr ? "Candidate Portal" : "Recruiter Portal"}
          </Link>
        </div>
      </div>
    </div>
  );
}
