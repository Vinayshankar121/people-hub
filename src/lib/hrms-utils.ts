export const DEPARTMENTS = [
  "Software Engineering",
  "HR Operations",
  "Quality Assurance",
  "Product Management",
  "Marketing",
] as const;

export const LEAVE_TYPES = ["Casual Leave", "Sick Leave", "Paid Leave"] as const;
export const HOLIDAY_TYPES = ["National", "Company"] as const;

export const STATUS_COLOR: Record<string, string> = {
  Present: "bg-blue-100 text-blue-700",
  Absent: "bg-rose-100 text-rose-700",
  Leave: "bg-amber-100 text-amber-700",
  Holiday: "bg-emerald-100 text-emerald-700",
  "Half Day": "bg-indigo-100 text-indigo-700",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  Draft: "bg-slate-100 text-slate-700",
  Locked: "bg-amber-100 text-amber-700",
  Paid: "bg-emerald-100 text-emerald-700",
};

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtMoney(n: number | null | undefined) {
  return `Rs. ${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}


export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function calcHours(inTime: string, outTime: string) {
  if (!inTime || !outTime) return 0;
  const [ih, im] = inTime.split(":").map(Number);
  const [oh, om] = outTime.split(":").map(Number);
  const diff = oh * 60 + om - (ih * 60 + im);
  return Math.max(0, Math.round((diff / 60) * 100) / 100);
}

export function eachDateInRange(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function isWeekend(iso: string) {
  const day = new Date(iso).getDay();
  return day === 0 || day === 6;
}
