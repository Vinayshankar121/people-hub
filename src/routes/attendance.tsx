import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { AttendancePage } from "@/features/AttendancePage";

export const Route = createFileRoute("/attendance")({ component: Attendance });

function Attendance() {
  return (
    <AppShell>
      <AttendancePage />
    </AppShell>
  );
}
