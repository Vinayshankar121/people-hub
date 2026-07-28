import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, CalendarCheck, PlaneTakeoff, Wallet,
  CalendarDays, Calendar as CalIcon, Settings, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { initials } from "@/lib/hrms-utils";

/* ── Sidebar open/close context (shared with Navbar hamburger) ── */

type SidebarCtx = { open: boolean; toggle: () => void; close: () => void };
const SidebarContext = createContext<SidebarCtx>({ open: false, toggle: () => {}, close: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <SidebarContext.Provider value={{ open, toggle, close }}>
      {children}
    </SidebarContext.Provider>
  );
}

/* ── Navigation items ── */

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/employees", label: "Employees", icon: Users, adminOnly: true },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, adminOnly: false },
  { to: "/leaves", label: "Leaves", icon: PlaneTakeoff, adminOnly: false },
  { to: "/payroll", label: "Payroll", icon: Wallet, adminOnly: false },
  { to: "/holidays", label: "Holidays", icon: CalendarDays, adminOnly: false },
  { to: "/calendar", label: "Calendar", icon: CalIcon, adminOnly: false },
  { to: "/appraisals", label: "Appraisals", icon: CalendarDays, adminOnly: false },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

/* ── Sidebar component ── */

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isAdmin = profile?.role === "Admin" || profile?.role === "CEO";
  const isCeo = profile?.role === "CEO";
  const { open, close } = useSidebar();

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
        <img
          src={settings?.general?.logoUrl || "/logo.jpg"}
          alt={settings?.general?.companyName || "Tech Minds"}
          className="h-10 w-10 rounded-xl object-cover bg-white"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/logo.jpg";
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{settings?.general?.companyName || "Tech Minds"}</p>
          <p className="text-xs text-slate-400">HRMS Portal</p>
        </div>
        {/* Close button — only on mobile overlay */}
        <button onClick={close} className="lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-slate-400">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.filter((n) => !n.adminOnly || isAdmin || isCeo).map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={close}
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

      {/* User footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="px-3 py-2 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-brand grid place-items-center text-xs font-semibold text-white shrink-0">
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
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:flex w-[264px] shrink-0 bg-sidebar text-sidebar-foreground flex-col h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile overlay + drawer (<lg) ── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          {/* Drawer panel */}
          <aside className="relative w-[280px] max-w-[85vw] h-full bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
