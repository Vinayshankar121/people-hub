import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { EmployeesPage } from "@/features/EmployeesPage";

export const Route = createFileRoute("/employees")({ component: Employees });

function Employees() {
  return (
    <AppShell adminOnly>
      <EmployeesPage />
    </AppShell>
  );
}
