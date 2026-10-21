import { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Mail,
  Bell,
  LogOut,
  User,
  Bookmark,
  FileText,
  Calendar,
  Clock,
  Settings,
  Briefcase,
  X,
  Send,
  ChevronDown,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { initials, authHeaders, timeAgo } from "../lib/hr";

// ── API types ──────────────────────────────────────────────────────────────────
interface InboxMessage {
  id: string;
  from_user_id: string;
  from_name: string;
  application_id: string | null;
  job_title: string | null;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

// ── Inbox Drawer ───────────────────────────────────────────────────────────────
function InboxDrawer({ open, onClose, onUnreadChange }: {
  open: boolean;
  onClose: () => void;
  onUnreadChange: (n: number) => void;
}) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyDone, setReplyDone] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages/inbox", { headers: authHeaders() });
      if (!res.ok) return;
      const data = (await res.json()) as InboxMessage[];
      setMessages(data);
      onUnreadChange(data.filter((m) => !m.read_at).length);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  // Load when drawer opens
  useEffect(() => {
    if (open) {
      loadInbox();
      setSelected(null);
      setReplyDone(false);
      setReplyText("");
    }
  }, [open, loadInbox]);

  async function markRead(msg: InboxMessage) {
    setSelected(msg);
    if (!msg.read_at) {
      await fetch(`/api/messages/${msg.id}/read`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m))
      );
      onUnreadChange(messages.filter((m) => !m.read_at && m.id !== msg.id).length);
    }
  }

  async function deleteMessage(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/messages/${id}`, { method: "DELETE", headers: authHeaders() });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
      onUnreadChange(messages.filter((m) => !m.read_at && m.id !== id).length);
    } finally {
      setDeleting(null);
    }
  }

  // Candidates can't reply via the API (only HR can send), so we show a
  // "Reply via email" convenience link instead of a real API call.
  function handleReply() {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setReplyDone(true);
      setReplyText("");
    }, 600);
  }

  if (!open) return null;

  return (
    <>
      <div className="cil-backdrop" onClick={onClose} />
      <div className="cil-drawer">
        <div className="cil-drawer-header">
          <div>
            <h3>Inbox</h3>
            {messages.filter((m) => !m.read_at).length > 0 && (
              <span className="cil-unread-badge">
                {messages.filter((m) => !m.read_at).length} unread
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button type="button" className="cil-close-btn" onClick={loadInbox} title="Refresh" disabled={loading}>
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
            <button type="button" className="cil-close-btn" onClick={onClose} aria-label="Close inbox">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="cil-drawer-body">
          {/* Message List */}
          <div className="cil-msg-list">
            {loading && messages.length === 0 && (
              <div className="cil-inbox-empty">
                <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} />
                <span>Loading…</span>
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="cil-inbox-empty">
                <Mail size={32} strokeWidth={1.3} />
                <span>No messages yet</span>
                <p>When a recruiter messages you, it will appear here.</p>
              </div>
            )}
            {messages.map((msg) => (
              <button
                key={msg.id}
                type="button"
                className={`cil-msg-item${!msg.read_at ? " unread" : ""}${selected?.id === msg.id ? " active" : ""}`}
                onClick={() => markRead(msg)}
              >
                <div className="cil-msg-avatar">{initials(msg.from_name)}</div>
                <div className="cil-msg-content">
                  <div className="cil-msg-top">
                    <span className="cil-msg-from">{msg.from_name}</span>
                    <span className="cil-msg-time">{timeAgo(msg.created_at)}</span>
                  </div>
                  {msg.job_title && (
                    <div className="cil-msg-role">{msg.job_title}</div>
                  )}
                  <div className="cil-msg-subject">{msg.subject}</div>
                  <div className="cil-msg-preview">{msg.body.slice(0, 80)}…</div>
                </div>
                {!msg.read_at && <span className="cil-unread-dot" />}
              </button>
            ))}
          </div>

          {/* Message Detail */}
          {selected ? (
            <div className="cil-msg-detail">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" className="cil-back-btn" onClick={() => setSelected(null)}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="cil-close-btn"
                  onClick={() => deleteMessage(selected.id)}
                  disabled={deleting === selected.id}
                  title="Delete message"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="cil-detail-header">
                <div className="cil-msg-avatar lg">{initials(selected.from_name)}</div>
                <div>
                  <strong>{selected.from_name}</strong>
                  <em>Recruiter{selected.job_title ? ` · ${selected.job_title}` : ""}</em>
                </div>
              </div>
              <h4 className="cil-detail-subject">{selected.subject}</h4>
              <p className="cil-detail-time">{timeAgo(selected.created_at)}</p>
              <div className="cil-detail-body">
                {selected.body.split("\n").map((line, i) => (
                  <p key={i}>{line || <br />}</p>
                ))}
              </div>

              {replyDone ? (
                <div className="cil-reply-done">
                  ✓ Note saved. To reply directly, use{" "}
                  <a href={`mailto:${selected.from_name}`}>email</a>.
                </div>
              ) : (
                <div className="cil-reply-box">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a note or reply…"
                    rows={3}
                  />
                  <button
                    type="button"
                    className="cil-reply-btn"
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                  >
                    <Send size={13} /> {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="cil-detail-placeholder">
              <Mail size={28} strokeWidth={1.3} />
              <span>Select a message to read</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Profile Dropdown ───────────────────────────────────────────────────────────
function ProfileDropdown({ name, email, onSignOut }: { name: string; email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  return (
    <div className="cil-profile-wrap" ref={ref}>
      <button type="button" className="cil-avatar-btn" onClick={() => setOpen((o) => !o)}>
        <span className="cil-avatar-circle">{initials(name)}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="cil-profile-dropdown">
          <div className="cil-profile-info">
            <span className="cil-avatar-circle">{initials(name)}</span>
            <div>
              <strong>{name}</strong>
              <em>{email || "Candidate"}</em>
            </div>
          </div>
          <Link to="/candidate/profile" className="cil-profile-link" onClick={() => setOpen(false)}>
            <User size={14} /> My Profile
          </Link>
          <Link to="/candidate/dashboard" className="cil-profile-link" onClick={() => setOpen(false)}>
            <Briefcase size={14} /> Dashboard
          </Link>
          <div className="cil-dropdown-divider" />
          <button
            type="button"
            className="cil-signout-btn"
            onClick={() => { setOpen(false); onSignOut(); }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Icon Rail Items ────────────────────────────────────────────────────────────
const ICON_NAV = [
  { icon: User,      label: "Profile",         to: "/candidate/profile" },
  { icon: Bookmark,  label: "Browse Jobs",     to: "/jobs" },
  { icon: FileText,  label: "My Applications", to: "/candidate/dashboard" },
  { icon: Calendar,  label: "Interviews",      to: "/candidate/dashboard" },
  { icon: Clock,     label: "History",         to: "/candidate/dashboard" },
  { icon: Settings,  label: "Settings",        to: "/candidate/profile" },
];

// ── Top Nav Links (no Mock Interview, no Career Coach) ─────────────────────────
const TOP_NAV = [
  { label: "Find Jobs",      to: "/jobs" },
  { label: "Companies",      to: "/companies" },
  { label: "MANGO Roles",    to: "/trending-roles" },
  { label: "AI CV Analysis", to: "/candidate/cv-analysis" },
  { label: "About",          to: "/" },
];

// ── Candidate Layout ───────────────────────────────────────────────────────────
export default function CandidateLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const name  = localStorage.getItem("name")  || "Candidate";
  const email = localStorage.getItem("email") || "";

  // Poll unread count every 30s while logged in
  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await fetch("/api/messages/unread-count", { headers: authHeaders() });
        if (res.ok) {
          const data = (await res.json()) as { count: number };
          setUnreadCount(data.count);
        }
      } catch { /* silent */ }
    }
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, []);

  function handleSignOut() {
    localStorage.clear();
    window.dispatchEvent(new Event("storage"));
    navigate("/");
  }

  const isJobsActive = pathname.startsWith("/jobs") || pathname.startsWith("/apply");

  return (
    <div className="cil-shell">
      {/* ── Top Navbar ──────────────────────────────────── */}
      <header className="cil-topnav">
        <Link to="/" className="cil-logo">
          <span className="cil-logo-mark">H</span>
          <span className="cil-logo-wordmark">HireSight</span>
        </Link>

        <nav className="cil-topnav-links">
          {TOP_NAV.map((item) => {
            const isActive =
              item.to === "/jobs"
                ? isJobsActive
                : item.to !== "/" && pathname.startsWith(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`cil-topnav-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="cil-topnav-right">
          {/* Inbox / Mail */}
          <button
            type="button"
            className="cil-icon-action"
            id="inbox-btn"
            onClick={() => setInboxOpen(true)}
            aria-label="Open inbox"
          >
            <Mail size={17} />
            {unreadCount > 0 && (
              <span className="cil-notif-dot">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>

          {/* Bell (notifications — placeholder) */}
          <button type="button" className="cil-icon-action" aria-label="Notifications" disabled>
            <Bell size={17} />
          </button>

          <ProfileDropdown name={name} email={email} onSignOut={handleSignOut} />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="cil-body">
        {/* Icon Rail */}
        <aside className="cil-iconrail">
          {ICON_NAV.map(({ icon: Icon, label, to }) => {
            const active =
              to === "/candidate/dashboard"
                ? pathname === "/candidate/dashboard"
                : to === "/jobs"
                ? isJobsActive
                : pathname.startsWith(to.split("?")[0]);
            return (
              <NavLink
                key={label}
                to={to}
                className={`cil-rail-btn${active ? " active" : ""}`}
                title={label}
              >
                <Icon size={18} />
              </NavLink>
            );
          })}
        </aside>

        {/* Content */}
        <main className="cil-content">
          <Outlet />
        </main>
      </div>

      {/* Inbox Drawer */}
      <InboxDrawer
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onUnreadChange={setUnreadCount}
      />
    </div>
  );
}
