import { ReactNode } from "react";
import { STATUS_COLOR } from "@/lib/hrms-utils";

type BadgeProps = {
  status?: string;
  variant?: "success" | "danger" | "warning" | "info" | "purple" | "default" | string;
  children?: ReactNode;
};

export function Badge({ status, variant, children }: BadgeProps) {
  const text = status || children;
  let cls = "bg-slate-100 text-slate-700";

  if (status && STATUS_COLOR[status]) {
    cls = STATUS_COLOR[status];
  } else if (variant === "success") {
    cls = "bg-emerald-100 text-emerald-800 border border-emerald-200";
  } else if (variant === "danger") {
    cls = "bg-rose-100 text-rose-800 border border-rose-200";
  } else if (variant === "warning") {
    cls = "bg-amber-100 text-amber-800 border border-amber-200";
  } else if (variant === "info") {
    cls = "bg-blue-100 text-blue-800 border border-blue-200";
  } else if (variant === "purple") {
    cls = "bg-purple-100 text-purple-800 border border-purple-200";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}
