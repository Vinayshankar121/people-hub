import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/hrms/AppShell";
import { PayrollPage } from "@/features/PayrollPage";

export const Route = createFileRoute("/payroll")({ component: Payroll });

function Payroll() {
  return (
    <AppShell>
      <PayrollPage />
    </AppShell>
  );
}