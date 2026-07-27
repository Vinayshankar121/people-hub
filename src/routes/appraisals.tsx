import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { AppraisalsPage } from "@/features/AppraisalsPage";

export const Route = createFileRoute("/appraisals")({
  component: Appraisals,
});

function Appraisals() {
  return (
    <AppShell>
      <AppraisalsPage />
    </AppShell>
  );
}

