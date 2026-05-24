import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, CalendarCheck, PlaneTakeoff, Wallet,
  CalendarDays, Calendar as CalIcon, LogOut, Building2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { initials } from "@/lib/hrms-utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/employees", label: "Employees", icon: Users, adminOnly: true },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, adminOnly: false },
  { to: "/leaves", label: "Leaves", icon: PlaneTakeoff, adminOnly: false },
  { to: "/payroll", label: "Payroll", icon: Wallet, adminOnly: false },
  { to: "/holidays", label: "Holidays", icon: CalendarDays, adminOnly: false },
  { to: "/calendar", label: "Calendar", icon: CalIcon, adminOnly: false },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isAdmin = profile?.role === "Admin";

  return (
    <aside className="w-[264px] shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 flex items-center gap-3 border-b border-sidebar-border">
        <div className="h-10 w-10 rounded-xl bg-brand grid place-items-center">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Tech Minds</p>
          <p className="text-xs text-slate-400">IT Solutions HRMS</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-slate-300 hover:bg-sidebar-accent hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="px-3 py-2 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-brand grid place-items-center text-xs font-semibold text-white">
            {initials(profile?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.name}</p>
            <p className="text-xs text-slate-400 truncate">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-300 hover:bg-sidebar-accent hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </aside>
  );
}
