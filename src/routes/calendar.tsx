import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { CalendarPage } from "@/features/CalendarPage";

export const Route = createFileRoute("/calendar")({ component: CalendarRoute });

function CalendarRoute() {
  return (
    <AppShell>
      <CalendarPage />
    </AppShell>
  );
}
