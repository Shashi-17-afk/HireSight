import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, Eye, EyeOff, ShieldCheck, RefreshCw } from "lucide-react";
import Seo from "../components/Seo";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // Step 1: "request", Step 2: "reset", Step 3: "success"
  const [step, setStep] = useState<"request" | "reset" | "success">("request");

  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // Resend cooldown timer (in seconds)
  const [cooldown, setCooldown] = useState(0);

  // Refs for the 4 OTP digit inputs
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first digit box when switching to Step 2
  useEffect(() => {
    if (step === "reset") {
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 100);
    }
  }, [step]);

  // Handle single digit OTP input & auto-advance
  function handleDigitChange(index: number, value: string) {
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue && value !== "") return;

    const newDigits = [...otpDigits];
    
    if (cleanValue.length > 1) {
      const chars = cleanValue.slice(0, 4).split("");
      chars.forEach((ch, idx) => {
        if (idx < 4) newDigits[idx] = ch;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(chars.length, 3);
      inputRefs[nextFocus].current?.focus();
    } else {
      newDigits[index] = cleanValue;
      setOtpDigits(newDigits);
      if (cleanValue && index < 3) {
        inputRefs[index + 1].current?.focus();
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pastedData) return;

    const newDigits = ["", "", "", ""];
    pastedData.split("").forEach((ch, idx) => {
      newDigits[idx] = ch;
    });
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, 3);
    inputRefs[nextIndex].current?.focus();
  }

  // Step 1 Submit: Request 4-digit OTP code
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await res.json()) as { message?: string; error?: string; retryAfter?: number };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to request verification code");
      }

      setInfoMessage(data.message || "Verification code sent! Please check your email.");
      setStep("reset");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP Code
  async function handleResendOtp() {
    if (cooldown > 0 || loading) return;
    setError("");
    setInfoMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to resend verification code");
      }

      setInfoMessage("A new 4-digit verification code has been sent to your email.");
      setOtpDigits(["", "", "", ""]);
      setCooldown(60);
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 Submit: Reset Password with OTP
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const otpCode = otpDigits.join("");
    if (otpCode.length !== 4) {
      setError("Please enter the full 4-digit verification code.");
      return;
    }

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otp: otpCode,
          new_password: newPassword,
        }),
      });

      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to reset password");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: "480px", paddingTop: "2.5rem" }}>
      <Seo title="Reset Password — HireSight" noIndex />

      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          to="/login/candidate"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} /> Back to Sign In
        </Link>
      </div>

      <div className="card">
        {step === "request" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "var(--card-bg-alt)",
                  border: "1px solid var(--card-border)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <KeyRound size={26} color="var(--brand)" />
              </div>
              <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem", fontFamily: "var(--font-heading)" }}>
                Forgot Password?
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: "1.5" }}>
                No worries! Enter your registered email address and we'll send you a <strong>4-digit OTP code</strong> to reset your password.
              </p>
            </div>

            <form onSubmit={(e) => void handleRequestOtp(e)}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
                    size={18}
                    style={{
                      position: "absolute",
                      left: "1rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: "2.75rem" }}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "var(--status-red)",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.88rem",
                    marginBottom: "1.25rem",
                    fontWeight: 500,
                  }}
                >
                  ⚠ {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-dark-pill btn-lg"
                style={{ width: "100%" }}
                disabled={loading}
              >
                {loading ? "Sending Code..." : "Send 4-Digit Code"}
              </button>
            </form>
          </div>
        )}

        {step === "reset" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "var(--card-bg-alt)",
                  border: "1px solid var(--card-border)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <ShieldCheck size={26} color="var(--brand)" />
              </div>
              <h1 style={{ fontSize: "1.75rem", marginBottom: "0.4rem", fontFamily: "var(--font-heading)" }}>
                Enter Verification Code
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                We sent a 4-digit code to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
              </p>
            </div>

            {infoMessage && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  color: "#059669",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.88rem",
                  marginBottom: "1.5rem",
                  textAlign: "center",
                  fontWeight: 500,
                }}
              >
                ✓ {infoMessage}
              </div>
            )}

            <form onSubmit={(e) => void handleResetPassword(e)}>
              {/* 4-Digit OTP Boxes */}
              <div style={{ marginBottom: "1.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    marginBottom: "0.6rem",
                    textAlign: "center",
                  }}
                >
                  4-Digit OTP Code
                </label>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "0.75rem",
                  }}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={inputRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      style={{
                        width: "60px",
                        height: "64px",
                        fontSize: "1.75rem",
                        fontWeight: 800,
                        textAlign: "center",
                        fontFamily: "monospace",
                        borderRadius: "var(--radius-md)",
                        border: digit
                          ? "2px solid var(--brand)"
                          : "1px solid var(--card-border)",
                        background: "var(--card-bg-alt)",
                        color: "var(--text-primary)",
                        transition: "all 0.15s ease",
                        boxShadow: digit ? "0 0 0 3px rgba(0, 0, 0, 0.05)" : "none",
                      }}
                    />
                  ))}
                </div>

                <div style={{ textAlign: "center", marginTop: "0.85rem" }}>
                  <button
                    type="button"
                    onClick={() => void handleResendOtp()}
                    disabled={cooldown > 0 || loading}
                    style={{
                      background: "none",
                      border: "none",
                      color: cooldown > 0 ? "var(--text-muted)" : "var(--brand)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: cooldown > 0 ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <RefreshCw size={14} className={loading ? "spin" : ""} />
                    {cooldown > 0 ? `Resend Code in ${cooldown}s` : "Didn't receive code? Resend"}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-input"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "1rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: "1.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "var(--status-red)",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.88rem",
                    marginBottom: "1.25rem",
                    fontWeight: 500,
                  }}
                >
                  ⚠ {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-dark-pill btn-lg"
                style={{ width: "100%" }}
                disabled={loading}
              >
                {loading ? "Updating Password..." : "Reset Password"}
              </button>
            </form>
          </div>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.25rem",
              }}
            >
              <CheckCircle2 size={36} color="#10b981" />
            </div>

            <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem", fontFamily: "var(--font-heading)" }}>
              Password Reset Complete! 🎉
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                marginBottom: "2rem",
                lineHeight: "1.5",
              }}
            >
              Your account password has been updated successfully. You can now sign in with your new password.
            </p>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-dark-pill btn-lg"
                style={{ width: "100%" }}
                onClick={() => navigate("/login/candidate")}
              >
                Sign In Now →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
