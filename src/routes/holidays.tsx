import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { HolidaysPage } from "@/features/HolidaysPage";

export const Route = createFileRoute("/holidays")({ component: Holidays });

function Holidays() {
  return (
    <AppShell>
      <HolidaysPage />
    </AppShell>
  );
}
