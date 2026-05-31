import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { CalendarManagementPage } from "@/features/CalendarManagementPage";

export const Route = createFileRoute("/admin/calendar")({
  component: AdminCalendarRoute,
});

function AdminCalendarRoute() {
  return (
    <AppShell>
      <CalendarManagementPage />
    </AppShell>
  );
}
