import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { DashboardPage } from "@/features/DashboardPage";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}
