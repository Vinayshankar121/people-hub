import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth, type EmployeeProfile } from "@/context/AuthContext";
import { Sidebar, SidebarProvider } from "@/components/hrms/Sidebar";
import { Navbar } from "@/components/hrms/Navbar";

/**
 * Shared application shell — sidebar + navbar + main content area.
 * Wraps every authenticated page and handles:
 *   - auth redirect
 *   - optional admin-only gating
 *   - responsive layout (sidebar drawer on mobile)
 */
export function AppShell({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" />;
  if (adminOnly && profile?.role !== "Admin") return <Navigate to="/" />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
