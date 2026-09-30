import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { authHeaders } from "../lib/hr";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const HR_SUGGESTIONS = [
  "How do I create a job with AI?",
  "How do I copy an apply link?",
  "What does an 80+ AI score mean?",
];

const CANDIDATE_SUGGESTIONS = [
  "How do I apply for a job?",
  "Why do I need to complete my profile?",
  "What does my AI score mean?",
];

function isTokenPresent(): boolean {
  return Boolean(localStorage.getItem("token") && localStorage.getItem("role"));
}

export default function HelpChat() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(isTokenPresent);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const role = localStorage.getItem("role") === "HR" ? "HR" : "candidate";
  const suggestions = role === "HR" ? HR_SUGGESTIONS : CANDIDATE_SUGGESTIONS;

  useEffect(() => {
    function sync() {
      const on = isTokenPresent();
      setVisible(on);
      if (!on) {
        setOpen(false);
        setMessages([]);
        setError("");
      }
    }
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [open, messages, busy]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const nextHistory: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(nextHistory);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/help/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ messages: nextHistory, path: pathname }),
      });
      const data = (await res.json()) as { reply?: string; error?: string; retryAfter?: number };
      if (res.status === 429) {
        throw new Error(`Too many messages. Try again in ${data.retryAfter ?? 60}s.`);
      }
      if (!res.ok) throw new Error(data.error ?? "Could not get a reply");
      if (!data.reply?.trim()) throw new Error("Empty reply from helper");
      setMessages([...nextHistory, { role: "assistant", content: data.reply.trim() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="help-chat">
      {open && (
        <section className="help-panel" role="dialog" aria-label="HireSight helper">
          <header className="help-panel-head">
            <span className="help-mark">
              <Sparkles size={16} />
            </span>
            <div>
              <strong>HireSight Helper</strong>
              <em>{role === "HR" ? "Recruiter guide" : "Candidate guide"}</em>
            </div>
            <button type="button" className="hr-icon-btn" onClick={() => setOpen(false)} aria-label="Close helper">
              <X size={16} />
            </button>
          </header>

          <div className="help-messages" ref={scroller}>
            {messages.length === 0 && (
              <div className="help-welcome">
                <p>Ask how to post a job, screen candidates, or read an AI score. I only answer HireSight how-tos.</p>
                <div className="help-suggestions">
                  {suggestions.map((item) => (
                    <button key={item} type="button" onClick={() => void send(item)} disabled={busy}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={`${msg.role}-${i}`} className={`help-bubble ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {busy && <div className="help-bubble assistant is-typing">Thinking…</div>}
            {error && <div className="help-error">{error}</div>}
          </div>

          <form
            className="help-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a how-to question…"
              maxLength={800}
              aria-label="Message the helper"
              disabled={busy}
            />
            <button type="submit" className="hr-icon-btn is-on" disabled={busy || !input.trim()} aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`help-fab${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close helper" : "Open HireSight helper"}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
