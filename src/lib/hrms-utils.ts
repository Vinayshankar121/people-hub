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
  return `₹ ${(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export const DEFAULT_STANDARD_WORKING_DAYS = Number(import.meta.env.VITE_STANDARD_WORKING_DAYS ?? 25);
export const DEFAULT_STANDARD_WORKING_HOURS = Number(import.meta.env.VITE_STANDARD_WORKING_HOURS ?? 9);
export const DEFAULT_OVERTIME_MULTIPLIER = Number(import.meta.env.VITE_OVERTIME_MULTIPLIER ?? 1.5);

export function roundToTwoDecimals(value: number | null | undefined) {
  const parsed = Number(value || 0);
  return Math.round(parsed * 100) / 100;
}

export function calculateWorkedHours(inTime: string | null | undefined, outTime: string | null | undefined) {
  if (!inTime || !outTime) return 0;
  const [ih, im] = inTime.split(":").map(Number);
  const [oh, om] = outTime.split(":").map(Number);
  const diff = oh * 60 + om - (ih * 60 + im);
  return roundToTwoDecimals(Math.max(0, diff / 60));
}

export function calcHours(inTime: string | null | undefined, outTime: string | null | undefined) {
  return calculateWorkedHours(inTime, outTime);
}

export function calculateHourlyRate(
  monthlySalary: number | null | undefined,
  standardWorkingDays = DEFAULT_STANDARD_WORKING_DAYS,
  standardWorkingHours = DEFAULT_STANDARD_WORKING_HOURS
) {
  const standardHours = standardWorkingDays * standardWorkingHours;
  if (!standardHours) return 0;
  return roundToTwoDecimals(Number(monthlySalary || 0) / standardHours);
}

export function calculateOvertime(totalWorkedHours: number | null | undefined, standardWorkingHours = DEFAULT_STANDARD_WORKING_HOURS) {
  const overtimeHours = Math.max(0, Number(totalWorkedHours || 0) - standardWorkingHours);
  return {
    overtimeHours: roundToTwoDecimals(overtimeHours),
    hasOvertime: overtimeHours > 0,
  };
}

export function calculateSalary({
  monthlySalary,
  standardWorkingDays = DEFAULT_STANDARD_WORKING_DAYS,
  standardWorkingHours = DEFAULT_STANDARD_WORKING_HOURS,
  totalWorkedHours,
  overtimeMultiplier = DEFAULT_OVERTIME_MULTIPLIER,
}: {
  monthlySalary: number | null | undefined;
  standardWorkingDays?: number;
  standardWorkingHours?: number;
  totalWorkedHours: number | null | undefined;
  overtimeMultiplier?: number;
}) {
  const hourlyRate = calculateHourlyRate(monthlySalary, standardWorkingDays, standardWorkingHours);
  const workedHours = Number(totalWorkedHours || 0);
  const { overtimeHours } = calculateOvertime(workedHours, standardWorkingHours);
  const overtimePay = roundToTwoDecimals(overtimeHours * hourlyRate * overtimeMultiplier);
  const grossSalary = roundToTwoDecimals((hourlyRate * workedHours) + overtimePay);

  return {
    hourlyRate,
    grossSalary,
    overtimeHours,
    overtimePay,
  };
}

export function formatHours(totalHours: number | null | undefined) {
  const hours = Number(totalHours || 0);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours} hrs ${String(minutes).padStart(2, "0")} mins`;
}

export function getAttendanceStatusFromHours(totalHours: number | null | undefined, hasApprovedLeave = false) {
  if (hasApprovedLeave) return "Leave";
  const hours = Number(totalHours || 0);
  if (hours >= 9) return "Present";
  if (hours >= 4.5) return "Half Day";
  return "Absent";
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
  return day === 0;
}

