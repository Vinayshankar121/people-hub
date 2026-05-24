import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { EmployeesPage } from "@/features/EmployeesPage";
import { Sidebar } from "@/components/hrms/Sidebar";
import { Navbar } from "@/components/hrms/Navbar";

export const Route = createFileRoute("/employees")({ component: Employees });

function Employees() {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;
  if (profile?.role !== "Admin") return <Navigate to="/" />;
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-8"><EmployeesPage /></main>
      </div>
    </div>
  );
}
