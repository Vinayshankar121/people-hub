import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { CalendarPage } from "@/features/CalendarPage";
import { Sidebar } from "@/components/hrms/Sidebar";
import { Navbar } from "@/components/hrms/Navbar";

export const Route = createFileRoute("/calendar")({ component: CalendarRoute });

function CalendarRoute() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-8"><CalendarPage /></main>
      </div>
    </div>
  );
}
