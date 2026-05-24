import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { LeavesPage } from "@/features/LeavesPage";

export const Route = createFileRoute("/leaves")({ component: Leaves });

function Leaves() {
  return (
    <AppShell>
      <LeavesPage />
    </AppShell>
  );
}
