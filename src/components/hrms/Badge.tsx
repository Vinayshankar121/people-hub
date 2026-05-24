import { STATUS_COLOR } from "@/lib/hrms-utils";

export function Badge({ status }: { status: string }) {
  const cls = STATUS_COLOR[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
