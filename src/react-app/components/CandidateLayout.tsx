import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, UserRound } from "lucide-react";
import WorkspaceLayout from "./WorkspaceLayout";

const NAV = [
  { to: "/candidate/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    to: "/jobs",
    label: "Browse Openings",
    icon: Briefcase,
    isActive: (pathname: string) => pathname.startsWith("/jobs") || pathname.startsWith("/apply"),
  },
  { to: "/candidate/profile", label: "My Profile", icon: UserRound, end: true },
];

export default function CandidateLayout() {
  const navigate = useNavigate();

  return (
    <WorkspaceLayout
      homeTo="/candidate/dashboard"
      subtitle="Candidate workspace"
      navLabel="My hiring"
      nav={NAV}
      searchPlaceholder="Search jobs by title…"
      roleLabel="Candidate"
      onSearch={(q) => {
        navigate(q ? `/jobs?q=${encodeURIComponent(q)}` : "/jobs");
      }}
    />
  );
}
