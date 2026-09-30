import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, Bell, LogOut, HelpCircle, X, type LucideIcon } from "lucide-react";
import { initials } from "../lib/hr";

export type WorkspaceNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  isActive?: (pathname: string, search: string) => boolean;
};

interface WorkspaceLayoutProps {
  homeTo: string;
  subtitle: string;
  navLabel: string;
  nav: WorkspaceNavItem[];
  searchPlaceholder: string;
  onSearch: (query: string) => void;
  roleLabel: string;
}

export default function WorkspaceLayout({
  homeTo,
  subtitle,
  navLabel,
  nav,
  searchPlaceholder,
  onSearch,
  roleLabel,
}: WorkspaceLayoutProps) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");

  const userName = localStorage.getItem("name") || roleLabel;
  const userEmail = localStorage.getItem("email") || "";

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    setQuery(params.get("q") ?? "");
  }, [search, pathname]);

  function handleSignOut() {
    localStorage.clear();
    window.dispatchEvent(new Event("storage"));
    navigate("/");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    onSearch(query.trim());
  }

  return (
    <div className="hr-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="hr-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`hr-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="hr-sidebar-brand">
          <Link to={homeTo} className="hr-brand-mark">
            <span className="hr-brand-letter">H</span>
            <span>
              <strong>HireSight</strong>
              <em>{subtitle}</em>
            </span>
          </Link>
          <button
            type="button"
            className="hr-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <p className="hr-nav-label">{navLabel}</p>
        <nav className="hr-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.isActive
              ? item.isActive(pathname, search)
              : item.end
                ? pathname === item.to
                : pathname.startsWith(item.to.split("?")[0]);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`hr-nav-link${active ? " active" : ""}`}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="hr-sidebar-footer">
          <a href="mailto:hello@hiresight.app" className="hr-help-card">
            <HelpCircle size={16} />
            <span>
              <strong>Need help?</strong>
              Contact support
            </span>
          </a>
          <div className="hr-user-chip">
            <span className="hr-avatar">{initials(userName)}</span>
            <span>
              <strong>{userName}</strong>
              <em>{userEmail || roleLabel}</em>
            </span>
          </div>
        </div>
      </aside>

      <div className="hr-main">
        <header className="hr-topbar">
          <button
            type="button"
            className="hr-icon-btn hr-menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <form className="hr-search" onSubmit={handleSearch}>
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search workspace"
            />
            <kbd>↵</kbd>
          </form>

          <div className="hr-topbar-actions">
            <span className="hr-live-dot" title="Workspace online" />
            <button type="button" className="hr-icon-btn" aria-label="Notifications" disabled>
              <Bell size={16} />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSignOut}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        <div className="hr-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
