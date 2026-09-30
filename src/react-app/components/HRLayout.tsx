import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, Sparkles, Users, CalendarCheck } from "lucide-react";
import WorkspaceLayout from "./WorkspaceLayout";

const NAV = [
  { to: "/hr/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/hr/jobs", label: "Job Requisition", icon: Briefcase, end: true },
  { to: "/hr/jobs/new", label: "Raise Recruitment", icon: Sparkles, end: true },
  { to: "/hr/candidates", label: "Candidates", icon: Users, end: true, isActive: (p: string, s: string) => p === "/hr/candidates" && !s.includes("stage=interview") },
  { to: "/hr/candidates?stage=interview", label: "Interviews", icon: CalendarCheck, isActive: (p: string, s: string) => p === "/hr/candidates" && s.includes("stage=interview") },
];

export default function HRLayout() {
  const navigate = useNavigate();

  return (
    <WorkspaceLayout
      homeTo="/hr/dashboard"
      subtitle="Recruiter workspace"
      navLabel="Recruitment"
      nav={NAV}
      searchPlaceholder="Search jobs, candidates, or requisition IDs…"
      roleLabel="Recruiter"
      onSearch={(q) => {
        const { pathname } = window.location;
        const target = pathname.startsWith("/hr/jobs") ? "/hr/jobs" : "/hr/candidates";
        navigate(q ? `${target}?q=${encodeURIComponent(q)}` : target);
      }}
    />
  );
}
