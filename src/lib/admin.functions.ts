// Client-side admin functions — converted from TanStack Start server functions.

// These run entirely in the browser and call Supabase directly.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";
import {
  calculateHourlyRate,
  calculateOvertime,
  calculateSalary,
  calcHours,
  getAttendanceStatusFromHours,
  roundToTwoDecimals,
  DEFAULT_STANDARD_WORKING_DAYS,
  DEFAULT_STANDARD_WORKING_HOURS,
} from "@/lib/hrms-utils";

async function getCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("Unauthorized: not signed in");
  return uid;
}

async function assertAdmin() {
  const userId = await getCurrentUserId();
  const { data } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("auth_uid", userId)
    .maybeSingle();
  if (data?.role !== "Admin") throw new Error("Forbidden: admin only");
  return userId;
}

async function assertAdminOrCeo() {
  const userId = await getCurrentUserId();
  const { data } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("auth_uid", userId)
    .maybeSingle();
  if (data?.role !== "Admin" && data?.role !== "CEO") throw new Error("Forbidden: admin or CEO only");
  return userId;
}

// ── Schemas ───────────────────────────────────────────────────────

const createEmployeeSchema = z.object({
  employee_id: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100).optional(),
  department: z.string().max(100).default(""),
  designation: z.string().max(100).default(""),
  salary: z.number().min(0).default(0),
  joiningDate: z.string().optional(),
  phone: z.string().max(50).default(""),
  role: z.enum(["Admin", "Employee", "CEO"]).default("Employee"),

  date_of_birth: z.string().optional(),
  bank_name: z.string().max(200).default(""),
  bank_account_no: z.string().max(100).default(""),
  pan_no: z.string().max(20).default(""),
  location: z.string().max(200).default(""),
  pf_no: z.string().max(50).default(""),
  universal_account_number: z.string().max(100).default(""),
  original_hire_date: z.string().optional(),
  total_days: z.number().min(0).default(0),
  lop: z.number().min(0).default(0),
  llop: z.number().min(0).default(0),
});

const updateEmployeeSchema = z.object({
  auth_uid: z.string().uuid(),
  name: z.string().min(1),
  department: z.string(),
  designation: z.string(),
  salary: z.number(),
  phone: z.string(),
  role: z.enum(["Admin", "Employee", "CEO"]),
  joiningDate: z.string().optional(),
  password: z.string().min(6).optional(),

  date_of_birth: z.string().optional(),
  bank_name: z.string().max(200).default(""),
  bank_account_no: z.string().max(100).default(""),
  pan_no: z.string().max(20).default(""),
  location: z.string().max(200).default(""),
  pf_no: z.string().max(50).default(""),
  universal_account_number: z.string().max(100).default(""),
  original_hire_date: z.string().optional(),
  total_days: z.number().min(0).default(0),
  lop: z.number().min(0).default(0),
  llop: z.number().min(0).default(0),
});

const deleteEmployeeSchema = z.object({ auth_uid: z.string().uuid() });

const approveLeaveSchema = z.object({
  leave_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  comment: z.string().max(500).optional(),
});

const reviewAttendanceEditSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

const payrollMonthSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(3000),
});

const pad = (value: number) => String(value).padStart(2, "0");
export function toISODateUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function makeMonthRangeUTC(month: number, year: number) {
  // Payroll period runs from the 27th of the previous month
  // through the 26th of the given month (inclusive).
  const startMonthIndex = (month - 2 + 12) % 12; // zero-based month index for previous month
  const startYear = month === 1 ? year - 1 : year;
  const start = new Date(Date.UTC(startYear, startMonthIndex, 27));
  const end = new Date(Date.UTC(year, month - 1, 26));
  return { start, end, startISO: toISODateUTC(start), endISO: toISODateUTC(end) };
}

function makePayrollDaySets(start: Date, end: Date, holidaySet: Set<string>) {
  const invalidDatesSet = new Set<string>();
  let workingDays = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    const iso = toISODateUTC(d);
    if (day === 0 || holidaySet.has(iso)) invalidDatesSet.add(iso);
    if (day !== 0 && !holidaySet.has(iso)) workingDays++;
  }

  return { invalidDatesSet, workingDays };
}

function calculatePayrollLeaveSummary(emp: any, leaves: any[]) {
  const paidEligibleSick = leaves
    .filter(
      (l: any) =>
        l.leave_type === "Sick Leave" &&
        l.is_paid_leave === true &&
        !l.converted_to_lwp
    )
    .reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);

  const paidEligibleCasual = leaves
    .filter(
      (l: any) =>
        l.leave_type === "Casual Leave" &&
        l.is_paid_leave === true &&
        !l.converted_to_lwp
    )
    .reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);

  const monthlyFreeTotal = Number((emp as any).monthly_free_total ?? 2);
  const totalPaidEligible = paidEligibleSick + paidEligibleCasual;
  const paid_leaves_used = Math.min(totalPaidEligible, monthlyFreeTotal);

  const paidSickUsed = Math.min(paidEligibleSick, paid_leaves_used);
  const paidCasualUsed = Math.min(
    paidEligibleCasual,
    Math.max(0, paid_leaves_used - paidSickUsed)
  );

  const unpaidFromLeaves = leaves
    .filter(
      (l: any) =>
        !l.is_paid_leave ||
        l.converted_to_lwp ||
        l.leave_type === "Leave Without Pay"
    )
    .reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);

  const extraEligiblePaid = Math.max(
    0,
    totalPaidEligible - paid_leaves_used
  );

  const unpaid_leave_days = Math.max(0, unpaidFromLeaves + extraEligiblePaid);

  return {
    paidEligibleSick,
    paidEligibleCasual,
    monthlyFreeTotal,
    paidSickUsed,
    paidCasualUsed,
    paid_leaves_used,
    unpaidFromLeaves,
    extraEligiblePaid,
    unpaid_leave_days,
  };
}

// Fetch leaves for a user for a month range. Some DBs may not have `days_count` column
// (older migration state). Try to select `days_count` first; if PostgREST errors
// about the missing column, fall back to selecting `start_date`/`end_date` and
// compute the days count client-side (inclusive).
async function fetchLeavesForMonth(userAuthUid: string, startISO: string, endISO: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("leaves")
      .select("leave_type, days_count, is_paid_leave, converted_to_lwp, start_date, end_date, status, user_auth_uid")
      .eq("user_auth_uid", userAuthUid)
      .eq("status", "Approved")
      .lte("start_date", endISO)
      .gte("end_date", startISO);

    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, days_count: Number(r.days_count ?? 1) }));
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("days_count") || msg.includes("is_paid_leave") || msg.includes("converted_to_lwp") || msg.includes("column")) {
      // Fallback: select only essential columns and compute days_count (working days)
      const { data, error } = await supabaseAdmin
        .from("leaves")
        .select("leave_type, start_date, end_date, status, user_auth_uid")
        .eq("user_auth_uid", userAuthUid)
        .eq("status", "Approved")
        .lte("start_date", endISO)
        .gte("end_date", startISO);

      if (error) throw new Error(`Failed loading leaves (fallback): ${error.message}`);
      const rows = data ?? [];
      // Compute working days (exclude weekends and holidays) for each leave
      return Promise.all(
        (rows as any[]).map(async (r: any) => {
          const s = new Date(r.start_date);
          const e = new Date(r.end_date);
          // fetch holidays in range to exclude them
          const { data: hol, error: holErr } = await supabaseAdmin
            .from("holidays")
            .select("date")
            .gte("date", r.start_date)
            .lte("date", r.end_date);
          if (holErr) throw new Error(`Failed loading holidays for leave fallback: ${holErr.message}`);
          const holidaySet = new Set((hol ?? []).map((h: any) => h.date));
          let count = 0;
          for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
            const iso = toISODateUTC(d);
            const day = d.getUTCDay();
            if (day === 0 || day === 6) continue;
            if (holidaySet.has(iso)) continue;
            count++;
          }
          // Provide sensible defaults for missing fields: assume paid by default and not converted
          return { ...r, days_count: Number(count || 1), is_paid_leave: true, converted_to_lwp: false };
        })
      );
    }
    throw err;
  }
}

async function safeUpsertPayrollRows(rows: any[]) {
  const attemptUpsert = async (payload: any[]) => {
    const { error } = await supabaseAdmin
      .from("payroll")
      .upsert(payload, { onConflict: "user_auth_uid,month,year" });
    return error;
  };

  let error = await attemptUpsert(rows);
  if (!error) return;

  const missingColumns = Array.from(new Set(
    (error.message.match(/column \"([^\"]+)\" does not exist/g) || [])
      .map((m) => m.replace(/column \"([^\"]+)\" does not exist/, "$1"))
  ));

  if (missingColumns.length === 0) {
    throw new Error("Failed saving payroll rows: " + error.message);
  }

  const filteredRows = rows.map((row) => {
    const cleaned: any = { ...row };
    for (const column of missingColumns) {
      delete cleaned[column];
    }
    return cleaned;
  });

  const retryError = await attemptUpsert(filteredRows);
  if (retryError) {
    throw new Error("Failed saving payroll rows after removing unsupported columns: " + retryError.message);
  }
}

async function getActiveSalaryForPeriod(
  emp: any,
  start: Date,
  end: Date,
  workingDays: number,
  invalidDatesSet: Set<string>
) {
  const { data: approvedAppraisals } = await supabaseAdmin
    .from("appraisals")
    .select("proposed_salary, current_salary, effective_from")
    .eq("employee_auth_uid", emp.auth_uid)
    .in("status", ["CEO Approved", "Payroll Updated", "Completed"])
    .order("effective_from", { ascending: true });

  if (!approvedAppraisals || approvedAppraisals.length === 0) {
    return {
      activeSalary: Number(emp.salary || 0),
      appraisalApplied: false,
      appraisalEffectiveFrom: null,
    };
  }

  let totalSalaryForPeriod = 0;
  let hasAppraisalInPeriod = false;
  let firstAppraisalEffective: string | null = null;

  for (let d = new Date(start.getTime()); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = toISODateUTC(d);
    if (invalidDatesSet.has(iso)) continue;

    let daySalary = Number(emp.salary || 0);
    let applicableAppraisal: any = null;

    for (const app of approvedAppraisals) {
      if (app.effective_from <= iso) {
        applicableAppraisal = app;
      }
    }

    if (applicableAppraisal) {
      daySalary = Number(applicableAppraisal.proposed_salary || 0);
      const appEff = new Date(applicableAppraisal.effective_from);
      const periodStart = new Date(start);
      const periodEnd = new Date(end);
      if (appEff >= periodStart && appEff <= periodEnd) {
        hasAppraisalInPeriod = true;
        if (!firstAppraisalEffective) {
          firstAppraisalEffective = applicableAppraisal.effective_from;
        }
      }
    }

    totalSalaryForPeriod += daySalary / workingDays;
  }

  const activeSalary = Math.round(totalSalaryForPeriod * 100) / 100;

  let endApplicableAppraisal: any = null;
  const endISO = toISODateUTC(end);
  for (const app of approvedAppraisals) {
    if (app.effective_from <= endISO) {
      endApplicableAppraisal = app;
    }
  }

  return {
    activeSalary,
    appraisalApplied: hasAppraisalInPeriod || !!endApplicableAppraisal,
    appraisalEffectiveFrom: firstAppraisalEffective || (endApplicableAppraisal ? endApplicableAppraisal.effective_from : null),
  };
}

// ── Functions ─────────────────────────────────────────────────────

export async function createEmployee({ data: raw }: { data: z.input<typeof createEmployeeSchema> }) {
  const data = createEmployeeSchema.parse(raw);
  await assertAdminOrCeo();

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("employees")
    .select("id")
    .or(`email.eq.${data.email},employee_id.eq.${data.employee_id}`)
    .limit(1)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);
  if (existing) {
    throw new Error("An employee with this email or employee ID already exists.");
  }

  const password = data.password || `${data.employee_id}@123`;
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password,
    email_confirm: true,
    user_metadata: {
      name: data.name,
      employee_id: data.employee_id,
      role: data.role,
      department: data.department,
      designation: data.designation,
      salary: data.salary,
      phone: data.phone,
      joiningDate: data.joiningDate,

      date_of_birth: data.date_of_birth,
      bank_name: data.bank_name,
      bank_account_no: data.bank_account_no,
      pan_no: data.pan_no,
      location: data.location,
      pf_no: data.pf_no,
      universal_account_number: data.universal_account_number,
      original_hire_date: data.original_hire_date,
      total_days: data.total_days,
      lop: data.lop,
      llop: data.llop,
    },
  });
  if (error) throw new Error(error.message);
  if (!created?.user?.id) throw new Error("Failed to create Supabase auth user");

  const authUid = created.user.id;
  const payload: any = {
    auth_uid: authUid,
    employee_id: data.employee_id,
    name: data.name,
    email: data.email,
    department: data.department,
    designation: data.designation,
    salary: data.salary,
    phone: data.phone,
    role: data.role,
    joiningDate: data.joiningDate ?? new Date().toISOString(),

    date_of_birth: data.date_of_birth || undefined,
    bank_name: data.bank_name,
    bank_account_no: data.bank_account_no,
    pan_no: data.pan_no,
    location: data.location,
    pf_no: data.pf_no,
    universal_account_number: data.universal_account_number,
  };

  const { error: upsertError } = await supabaseAdmin
    .from("employees")
    .upsert(payload, { onConflict: "auth_uid" });

  if (upsertError) {
    await supabaseAdmin.auth.admin.deleteUser(authUid).catch(() => null);
    throw new Error(upsertError.message);
  }

  return { success: true, auth_uid: authUid };
}

export async function deleteEmployee({ data: raw }: { data: z.input<typeof deleteEmployeeSchema> }) {
  const data = deleteEmployeeSchema.parse(raw);
  const userId = await assertAdminOrCeo();

  if (data.auth_uid === userId) throw new Error("Cannot delete yourself");
  await supabaseAdmin.auth.admin.deleteUser(data.auth_uid);
  return { success: true };
}

export async function updateEmployee({ data: raw }: { data: z.input<typeof updateEmployeeSchema> }) {
  const data = updateEmployeeSchema.parse(raw);
  await assertAdminOrCeo();

  const { auth_uid, password, ...patch } = data;
  if (password) await supabaseAdmin.auth.admin.updateUserById(auth_uid, { password });

  // Normalize optional date strings -> undefined so DB defaults apply
  const normalized: any = { ...patch };
  if (normalized.date_of_birth === "") normalized.date_of_birth = undefined;
  if (normalized.original_hire_date === "") normalized.original_hire_date = undefined;
  if (normalized.joiningDate === "") normalized.joiningDate = undefined;

  await supabaseAdmin.from("employees").update(normalized).eq("auth_uid", auth_uid);
}

export async function approveLeave({ data: raw }: { data: z.input<typeof approveLeaveSchema> }) {
  const data = approveLeaveSchema.parse(raw);
  await assertAdminOrCeo();

  const { data: leave } = await supabaseAdmin
    .from("leaves")
    .select("*")
    .eq("id", data.leave_id)
    .single();
  if (!leave) throw new Error("Leave not found");

  const status = data.action === "approve" ? "Approved" : "Rejected";
  await supabaseAdmin
    .from("leaves")
    .update({ status, admin_comment: data.comment ?? "" })
    .eq("id", data.leave_id);

  if (data.action === "approve") {
    const { data: holidays } = await supabaseAdmin.from("holidays").select("date");
    const holidaySet = new Set((holidays ?? []).map((h: any) => h.date));
    const d = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const rows: any[] = [];
    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      const day = d.getDay();
      if (day !== 0 && day !== 6 && !holidaySet.has(iso)) {
        rows.push({
          user_auth_uid: leave.user_auth_uid,
          date: iso,
          status: "Leave",
          approval_status: "Approved",
        });
      }
      d.setDate(d.getDate() + 1);
    }
    if (rows.length) {
      await supabaseAdmin
        .from("attendance")
        .upsert(rows, { onConflict: "user_auth_uid,date" });
    }
  }
  return { success: true };
}

export async function reviewAttendanceEdit({ data: raw }: { data: z.input<typeof reviewAttendanceEditSchema> }) {
  const data = reviewAttendanceEditSchema.parse(raw);
  const userId = await assertAdminOrCeo();

  if (data.action === "approve") {
    const { data: row } = await supabaseAdmin
      .from("attendance")
      .select("punch_in_time, punch_out_time")
      .eq("id", data.id)
      .single();

    if (row) {
      const hours = calcHours(row.punch_in_time, row.punch_out_time);
      const status = getAttendanceStatusFromHours(hours);

      await supabaseAdmin
        .from("attendance")
        .update({
          approval_status: "Approved",
          edit_requested: false,
          approved_by: userId,
          approved_at: new Date().toISOString(),
          status,
        })
        .eq("id", data.id);
    }
  } else {
    const { data: row } = await supabaseAdmin
      .from("attendance")
      .select("*")
      .eq("id", data.id)
      .single();
    if (row) {
      const hours = calcHours(row.original_punch_in, row.original_punch_out);
      const status = getAttendanceStatusFromHours(hours);

      await supabaseAdmin
        .from("attendance")
        .update({
          approval_status: "Rejected",
          edit_requested: false,
          punch_in_time: row.original_punch_in,
          punch_out_time: row.original_punch_out,
          status,
        })
        .eq("id", data.id);
    }
  }
  return { success: true };
}

export function getDynamicAttendanceStatus(
  attRecord: any | undefined,
  hasApprovedLeave: boolean
): "Present" | "Half Day" | "Absent" | "Leave" {
  if (hasApprovedLeave) {
    return "Leave";
  }
  if (!attRecord) {
    return "Absent";
  }

  const dbStatus = String(attRecord.status ?? "").trim().toUpperCase();
  if (dbStatus === "PRESENT") return "Present";
  if (dbStatus === "HALF DAY") return "Half Day";
  if (dbStatus === "ABSENT") return "Absent";
  if (dbStatus === "LEAVE") {
    return attRecord.approval_status === "Approved" ? "Leave" : "Absent";
  }

  const hours = Number(attRecord.total_hours ?? calcHours(attRecord.punch_in_time, attRecord.punch_out_time));
  return getAttendanceStatusFromHours(hours);
}

export async function getAttendanceSummaryForPeriod(userAuthUid: string, month: number, year: number) {
  const { start, end, startISO, endISO } = makeMonthRangeUTC(month, year);

  const { data: holidays } = await supabase
    .from("holidays")
    .select("date, category")
    .gte("date", startISO)
    .lte("date", endISO);

  const holidaySet = new Set(
    (holidays ?? [])
      .filter((h: any) => h.category !== "Optional" && h.category !== "Weekend")
      .map((h: any) => h.date)
  );

  const { invalidDatesSet, workingDays } = makePayrollDaySets(start, end, holidaySet);

  const { data: att } = await supabase
    .from("attendance")
    .select("status, date, punch_in_time, punch_out_time, approval_status")
    .eq("user_auth_uid", userAuthUid)
    .gte("date", startISO)
    .lte("date", endISO);

  const attendanceMap = new Map((att ?? []).map((a: any) => [a.date, a]));

  const { data: leaves } = await supabase
    .from("leaves")
    .select("start_date, end_date, leave_type")
    .eq("user_auth_uid", userAuthUid)
    .eq("status", "Approved")
    .or(`start_date.lte.${endISO},end_date.gte.${startISO}`);

  const approvedLeavesList = leaves ?? [];

  const isDateCoveredByApprovedLeave = (dateStr: string) => {
    return approvedLeavesList.some((l: any) => {
      return dateStr >= l.start_date && dateStr <= l.end_date;
    });
  };

  let presentDays = 0;
  let halfDays = 0;
  let approvedLeaveDays = 0;
  let absentDays = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = toISODateUTC(d);
    if (invalidDatesSet.has(iso)) continue;

    const attRecord = attendanceMap.get(iso);
    const hasApprovedLeaveTable = isDateCoveredByApprovedLeave(iso);

    const computedStatus = getDynamicAttendanceStatus(attRecord, hasApprovedLeaveTable);

    if (computedStatus === "Present") {
      presentDays++;
    } else if (computedStatus === "Half Day") {
      halfDays++;
      presentDays += 0.5;
      absentDays += 0.5;
    } else if (computedStatus === "Leave") {
      approvedLeaveDays++;
    } else if (computedStatus === "Absent") {
      absentDays++;
    }
  }

  const freeLeavesLimit = 2;
  const paidLeavesUsed = Math.min(approvedLeaveDays, freeLeavesLimit);
  const lopDays = Math.max(0, approvedLeaveDays - freeLeavesLimit);

  return {
    workingDays,
    presentDays,
    halfDays,
    approvedLeaves: approvedLeaveDays,
    paidLeaves: paidLeavesUsed,
    unpaidLeaves: lopDays,
    absentDays,
    holidays: holidaySet.size,
  };
}

export async function generatePayroll({ data: raw }: { data: z.input<typeof payrollMonthSchema> }) {
  const data = payrollMonthSchema.parse(raw);
  await assertAdminOrCeo();

  const { month, year } = data;
  const { start, end, startISO, endISO } = makeMonthRangeUTC(month, year);

  const { data: emps } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("role", "Employee");

  const { data: holidays } = await supabaseAdmin
    .from("holidays")
    .select("date, category")
    .gte("date", startISO)
    .lte("date", endISO);

  const holidaySet = new Set(
    (holidays ?? [])
      .filter((h: any) => h.category !== "Optional" && h.category !== "Weekend")
      .map((h: any) => h.date)
  );

  const { invalidDatesSet, workingDays: rawWorkingDays } = makePayrollDaySets(start, end, holidaySet);
  let workingDays = rawWorkingDays;
  if (workingDays < 1) workingDays = 1;

  const rows: any[] = [];
  const errors: string[] = [];

  for (const emp of emps ?? []) {
    if (!emp.auth_uid) continue;

    try {
      // 1. Fetch attendance records in the range
      const { data: att } = await supabaseAdmin
        .from("attendance")
        .select("status, date, punch_in_time, punch_out_time, total_hours, approval_status")
        .eq("user_auth_uid", emp.auth_uid)
        .gte("date", startISO)
        .lte("date", endISO);
      const attendance = att ?? [];
      const attendanceMap = new Map(attendance.map((a: any) => [a.date, a]));
      const totalWorkedHours = attendance.reduce((sum: number, a: any) => sum + Number(a.total_hours || 0), 0);

      // 2. Fetch approved leaves covering the range
      const { data: leaves } = await supabaseAdmin
        .from("leaves")
        .select("start_date, end_date, leave_type")
        .eq("user_auth_uid", emp.auth_uid)
        .eq("status", "Approved")
        .or(`start_date.lte.${endISO},end_date.gte.${startISO}`);
      const approvedLeavesList = leaves ?? [];

      const isDateCoveredByApprovedLeave = (dateStr: string) => {
        return approvedLeavesList.some((l: any) => {
          return dateStr >= l.start_date && dateStr <= l.end_date;
        });
      };

      let presentDays = 0;
      let halfDays = 0;
      let approvedLeaveDays = 0;
      let absentDays = 0;

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = toISODateUTC(d);
        if (invalidDatesSet.has(iso)) continue; // Skip weekends and holidays

        const attRecord = attendanceMap.get(iso);
        const hasApprovedLeaveTable = isDateCoveredByApprovedLeave(iso);

        const computedStatus = getDynamicAttendanceStatus(attRecord, hasApprovedLeaveTable);

        if (computedStatus === "Present") {
          presentDays++;
        } else if (computedStatus === "Half Day") {
          halfDays++;
          presentDays += 0.5;
          absentDays += 0.5;
        } else if (computedStatus === "Leave") {
          approvedLeaveDays++;
        } else if (computedStatus === "Absent") {
          absentDays++;
        }
      }

      // Free leaves logic: Max 2 free approved leaves per month.
      const freeLeavesLimit = 2;
      const paidLeavesUsed = Math.min(approvedLeaveDays, freeLeavesLimit);
      const lopDays = Math.max(0, approvedLeaveDays - freeLeavesLimit);

      const { activeSalary, appraisalApplied, appraisalEffectiveFrom } = await getActiveSalaryForPeriod(
        emp, start, end, workingDays, invalidDatesSet
      );

      const standardWorkingDays = Number((emp as any).standard_working_days ?? DEFAULT_STANDARD_WORKING_DAYS) || DEFAULT_STANDARD_WORKING_DAYS;
      const standardWorkingHours = Number((emp as any).standard_working_hours ?? DEFAULT_STANDARD_WORKING_HOURS) || DEFAULT_STANDARD_WORKING_HOURS;
      const salaryCalc = calculateSalary({
        monthlySalary: activeSalary,
        standardWorkingDays,
        standardWorkingHours,
        totalWorkedHours,
      });
      const perDaySalary = Math.round((activeSalary / Math.max(1, workingDays)) * 100) / 100;
      const leaveDeduction = roundToTwoDecimals((absentDays + lopDays) * perDaySalary);
      const grossSalary = roundToTwoDecimals(salaryCalc.grossSalary);
      const deductions = roundToTwoDecimals(leaveDeduction);
      const netSalary = roundToTwoDecimals(Math.max(0, grossSalary - deductions));

      const yearlySalary = activeSalary * 12;
      const basicSalary = Math.round(activeSalary * 0.5 * 100) / 100;
      const hra = Math.round(activeSalary * 0.3 * 100) / 100;
      const otherAllowances = Math.round(activeSalary * 0.2 * 100) / 100;
      const yearlyBasic = Math.round(basicSalary * 12 * 100) / 100;
      const yearlyHra = Math.round(hra * 12 * 100) / 100;
      const yearlyOtherAllowances = Math.round(otherAllowances * 12 * 100) / 100;

      rows.push({
        user_auth_uid: emp.auth_uid,
        month,
        year,
        basicSalary,
        monthlySalary: activeSalary,
        yearlySalary,
        hra,
        otherAllowances,
        yearlyBasic,
        yearlyHra,
        yearlyOtherAllowances,
        workingDays,
        presentDays,
        absentDays,
        approvedLeaves: Math.round(approvedLeaveDays),
        holidays: holidaySet.size,
        standardWorkingDays,
        standardWorkingHours,
        hourlyRate: salaryCalc.hourlyRate,
        totalWorkedHours: roundToTwoDecimals(totalWorkedHours),
        overtimeHours: salaryCalc.overtimeHours,
        grossSalary,
        deductions,
        overtimeMultiplier: 1.5,
        leave_deductions: roundToTwoDecimals(lopDays * perDaySalary),
        paid_leaves_used: paidLeavesUsed,
        unpaid_leave_days: lopDays,
        netSalary,
        appraisalApplied,
        appraisalEffectiveFrom,
        status: "Paid",
      });
    } catch (err: any) {
      const id = emp.employee_id ?? emp.auth_uid ?? '<unknown>';
      errors.push(`${id}: ${err?.message ?? String(err)}`);
      continue;
    }
  }

  if (rows.length) {
    await safeUpsertPayrollRows(rows);
  }

  if (errors.length) {
    const msg = `Payroll partial success: ${rows.length} saved, ${errors.length} failed. Errors: ${errors.join(' | ')}`;
    throw new Error(msg);
  }

  return { success: true, count: rows.length };
}


export async function previewPayroll({ data: raw }: { data: z.input<typeof payrollMonthSchema> }) {
  const data = payrollMonthSchema.parse(raw);
  await assertAdminOrCeo();

  const { month, year } = data;
  const { start, end, startISO, endISO } = makeMonthRangeUTC(month, year);

  const { data: emps } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("role", "Employee");
  const { data: holidays } = await supabaseAdmin
    .from("holidays")
    .select("date, category")
    .gte("date", startISO)
    .lte("date", endISO);

  const holidaySet = new Set(
    (holidays ?? [])
      .filter((h: any) => h.category !== "Optional" && h.category !== "Weekend")
      .map((h: any) => h.date)
  );

  const { invalidDatesSet, workingDays: rawWorkingDays } = makePayrollDaySets(start, end, holidaySet);
  let workingDays = rawWorkingDays;
  if (workingDays < 1) workingDays = 1;

  const holidayCount = holidaySet.size;

  const preview: any[] = [];
  for (const emp of emps ?? []) {
    if (!emp.auth_uid) continue; // Skip employees without auth_uid

    // 1. Fetch attendance records in the range
    const { data: att } = await supabaseAdmin
      .from("attendance")
      .select("status, date, punch_in_time, punch_out_time, total_hours, approval_status")
      .eq("user_auth_uid", emp.auth_uid)
      .gte("date", startISO)
      .lte("date", endISO);
    const attendance = att ?? [];
    const attendanceMap = new Map(attendance.map((a: any) => [a.date, a]));
    const totalWorkedHours = attendance.reduce((sum: number, a: any) => sum + Number(a.total_hours || 0), 0);

    // 2. Fetch approved leaves covering the range
    const { data: leaves } = await supabaseAdmin
      .from("leaves")
      .select("start_date, end_date, leave_type")
      .eq("user_auth_uid", emp.auth_uid)
      .eq("status", "Approved")
      .or(`start_date.lte.${endISO},end_date.gte.${startISO}`);
    const approvedLeavesList = leaves ?? [];

    const isDateCoveredByApprovedLeave = (dateStr: string) => {
      return approvedLeavesList.some((l: any) => {
        return dateStr >= l.start_date && dateStr <= l.end_date;
      });
    };

    let presentDays = 0;
    let halfDays = 0;
    let approvedLeaveDays = 0;
    let absentDays = 0;

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = toISODateUTC(d);
      if (invalidDatesSet.has(iso)) continue;

      const attRecord = attendanceMap.get(iso);
      const hasApprovedLeaveTable = isDateCoveredByApprovedLeave(iso);

      const computedStatus = getDynamicAttendanceStatus(attRecord, hasApprovedLeaveTable);

      if (computedStatus === "Present") {
        presentDays++;
      } else if (computedStatus === "Half Day") {
        halfDays++;
        presentDays += 0.5;
        absentDays += 0.5;
      } else if (computedStatus === "Leave") {
        approvedLeaveDays++;
      } else if (computedStatus === "Absent") {
        absentDays++;
      }
    }

    const freeLeavesLimit = 2;
    const paidLeavesUsed = Math.min(approvedLeaveDays, freeLeavesLimit);
    const lopDays = Math.max(0, approvedLeaveDays - freeLeavesLimit);

    const { activeSalary, appraisalApplied, appraisalEffectiveFrom } = await getActiveSalaryForPeriod(
      emp, start, end, workingDays, invalidDatesSet
    );

    const standardWorkingDays = Number((emp as any).standard_working_days ?? DEFAULT_STANDARD_WORKING_DAYS) || DEFAULT_STANDARD_WORKING_DAYS;
    const standardWorkingHours = Number((emp as any).standard_working_hours ?? DEFAULT_STANDARD_WORKING_HOURS) || DEFAULT_STANDARD_WORKING_HOURS;
    const salaryCalc = calculateSalary({
      monthlySalary: activeSalary,
      standardWorkingDays,
      standardWorkingHours,
      totalWorkedHours,
    });
    const perDaySalary = Math.round((activeSalary / Math.max(1, workingDays)) * 100) / 100;
    const leaveDeduction = roundToTwoDecimals((absentDays + lopDays) * perDaySalary);
    const grossSalary = roundToTwoDecimals(salaryCalc.grossSalary);
    const deductions = roundToTwoDecimals(leaveDeduction);
    const netSalary = roundToTwoDecimals(Math.max(0, grossSalary - deductions));
    const payableDays = Math.max(0, workingDays - absentDays - lopDays);

    const yearlySalary = activeSalary * 12;
    const basicSalary = Math.round(activeSalary * 0.5 * 100) / 100;
    const hra = Math.round(activeSalary * 0.3 * 100) / 100;
    const otherAllowances = Math.round(activeSalary * 0.2 * 100) / 100;
    const yearlyBasic = Math.round(basicSalary * 12 * 100) / 100;
    const yearlyHra = Math.round(hra * 12 * 100) / 100;
    const yearlyOtherAllowances = Math.round(otherAllowances * 12 * 100) / 100;

    preview.push({
      auth_uid: emp.auth_uid,
      name: emp.name,
      employee_id: emp.employee_id,
      department: emp.department,
      basicSalary,
      monthlySalary: activeSalary,
      yearlySalary,
      hra,
      otherAllowances,
      yearlyBasic,
      yearlyHra,
      yearlyOtherAllowances,
      workingDays,
      presentDays,
      absentDays,
      approvedLeaves: Math.round(approvedLeaveDays),
      holidays: holidayCount,
      standardWorkingDays,
      standardWorkingHours,
      hourlyRate: salaryCalc.hourlyRate,
      totalWorkedHours: roundToTwoDecimals(totalWorkedHours),
      overtimeHours: salaryCalc.overtimeHours,
      grossSalary,
      deductions,
      netSalary,
      paid_leaves_used: paidLeavesUsed,
      unpaid_leave_days: lopDays,
      leave_deductions: Math.round(lopDays * perDaySalary * 100) / 100,
      payableDays,
      appraisalApplied,
      appraisalEffectiveFrom,
      status: "Paid",
    });
  }
  return { preview, workingDays, holidayCount };
}
