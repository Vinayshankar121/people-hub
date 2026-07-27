import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { SettingsPage } from "@/features/SettingsPage";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  return (
    <AppShell adminOnly>
      <SettingsPage />
    </AppShell>
  );
}
