import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { DashboardPage } from "@/features/DashboardPage";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;
  return <AppShell><DashboardPage /></AppShell>;
}

import { Sidebar } from "@/components/hrms/Sidebar";
import { Navbar } from "@/components/hrms/Navbar";
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
