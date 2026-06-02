// Client-side admin functions — converted from TanStack Start server functions.
// These run entirely in the browser and call Supabase directly.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";

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
  role: z.enum(["Admin", "Employee"]).default("Employee"),

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
  role: z.enum(["Admin", "Employee"]),
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
function toISODateUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function makeMonthRangeUTC(month: number, year: number) {
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
    if (day === 0 || day === 6 || holidaySet.has(iso)) invalidDatesSet.add(iso);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) workingDays++;
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
    throw new Error(`Failed saving payroll rows: ${error.message}`);
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
    throw new Error(`Failed saving payroll rows after removing unsupported columns (${missingColumns.join(', ')}): ${retryError.message}`);
  }
}

// ── Functions ─────────────────────────────────────────────────────

export async function createEmployee({ data: raw }: { data: z.input<typeof createEmployeeSchema> }) {
  const data = createEmployeeSchema.parse(raw);
  await assertAdmin();

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
  const userId = await assertAdmin();

  if (data.auth_uid === userId) throw new Error("Cannot delete yourself");
  await supabaseAdmin.auth.admin.deleteUser(data.auth_uid);
  return { success: true };
}

export async function updateEmployee({ data: raw }: { data: z.input<typeof updateEmployeeSchema> }) {
  const data = updateEmployeeSchema.parse(raw);
  await assertAdmin();

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
  await assertAdmin();

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
  const userId = await assertAdmin();

  if (data.action === "approve") {
    await supabaseAdmin
      .from("attendance")
      .update({
        approval_status: "Approved",
        edit_requested: false,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
  } else {
    const { data: row } = await supabaseAdmin
      .from("attendance")
      .select("*")
      .eq("id", data.id)
      .single();
    if (row) {
      await supabaseAdmin
        .from("attendance")
        .update({
          approval_status: "Rejected",
          edit_requested: false,
          punch_in_time: row.original_punch_in,
          punch_out_time: row.original_punch_out,
        })
        .eq("id", data.id);
    }
  }
  return { success: true };
}

export async function generatePayroll({ data: raw }: { data: z.input<typeof payrollMonthSchema> }) {
  const data = payrollMonthSchema.parse(raw);
  await assertAdmin();

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
      const { data: att } = await supabaseAdmin
        .from("attendance")
        .select("status, date")
        .eq("user_auth_uid", emp.auth_uid)
        .gte("date", startISO)
        .lte("date", endISO);

      const attendance = att ?? [];

      // valid working-day attendance only (ignore any mistaken weekend/holiday attendance)
      const validAttendance = attendance.filter((a: any) => !invalidDatesSet.has(a.date));

      const normalizeStatus = (status: any) => {
        const s = String(status ?? "").trim();
        const upper = s.toUpperCase();
        if (upper === "PRESENT") return "Present";
        if (upper === "HALF DAY") return "Half Day";
        if (upper === "LEAVE") return "Leave";
        if (upper === "ABSENT") return "Absent";
        return s;
      };

      const presentDays = validAttendance.filter((a: any) => normalizeStatus(a.status) === "Present").length;
      const halfDays = validAttendance.filter((a: any) => normalizeStatus(a.status) === "Half Day").length;
      const approvedLeaves = validAttendance.filter((a: any) => normalizeStatus(a.status) === "Leave").length;
      const fullAbsentDays = Math.max(0, workingDays - presentDays - approvedLeaves - halfDays);


      // Paid-leave conversion policy (monthly):
      // - 2 paid leaves per month total
      // - extra approved Sick/Casual paid leave days become unpaid/LWP
      // NOTE: Attendance rows for Leave do not carry leave_type/is_paid_leave; backend uses leaves table.
      const leaves = await fetchLeavesForMonth(emp.auth_uid, startISO, endISO);
      const leaveSummary = calculatePayrollLeaveSummary(emp, leaves);
      const { paid_leaves_used, unpaid_leave_days } = leaveSummary;

      const perDaySalary = Number(emp.salary || 0) / workingDays;

      // Half Day logic:
      // - Half Day = 0.5 unpaid day per half-day
      // - Full absent days exclude presentDays, approvedLeaves, and halfDays
      // Deduction days = fullAbsentDays + halfDayUnpaidEquivalent + unpaid_leave_days
      const halfDayUnpaidEquivalent = halfDays * 0.5;

      const deductionDays = fullAbsentDays + halfDayUnpaidEquivalent + unpaid_leave_days;

      const leave_deductions = Math.round(perDaySalary * unpaid_leave_days * 100) / 100;

      // Split remaining absence portion (full absent + half-day unpaid equivalent)
      const absence_deductions = Math.round(perDaySalary * (fullAbsentDays + halfDayUnpaidEquivalent) * 100) / 100;


      const deductions = leave_deductions + absence_deductions;

      const netSalary = Math.round((Number(emp.salary || 0) - deductions) * 100) / 100;

      // Salary breakdown (kept as-is: Basic/HRA/Other)
      const monthlySalary = Number(emp.salary || 0);
      const yearlySalary = monthlySalary * 12;
      const basicSalary = monthlySalary * 0.50;
      const hra = monthlySalary * 0.30;
      const otherAllowances = monthlySalary * 0.20;
      const yearlyBasic = basicSalary * 12;
      const yearlyHra = hra * 12;
      const yearlyOtherAllowances = otherAllowances * 12;

      rows.push({
        user_auth_uid: emp.auth_uid,
        month,
        year,
        "basicSalary": basicSalary,
        "monthlySalary": monthlySalary,
        "yearlySalary": yearlySalary,
        hra,
        other_allowances: otherAllowances,
        yearly_basic: yearlyBasic,
        yearly_hra: yearlyHra,
        yearly_other_allowances: yearlyOtherAllowances,
        "workingDays": workingDays,
        presentDays,
        absentDays: fullAbsentDays,

        // Track approvedLeaves as full-day leave count from attendance
        approvedLeaves,
        holidays: holidaySet.size,
        deductions,
        leave_deductions,
        paid_leaves_used,
        unpaid_leave_days,
        netSalary,
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
  await assertAdmin();

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
    
    const { data: att } = await supabaseAdmin
      .from("attendance")
      .select("status, date")
      .eq("user_auth_uid", emp.auth_uid)
      .gte("date", startISO)
      .lte("date", endISO);

    const attendance = att ?? [];

    // valid working-day attendance only (ignore any mistaken weekend/holiday attendance)
    const validAttendance = attendance.filter((a: any) => !invalidDatesSet.has(a.date));

    const normalizeStatus = (status: any) => {
      const s = String(status ?? "").trim();
      const upper = s.toUpperCase();
      if (upper === "PRESENT") return "Present";
      if (upper === "HALF DAY") return "Half Day";
      if (upper === "LEAVE") return "Leave";
      if (upper === "ABSENT") return "Absent";
      return s;
    };

    const presentDays = validAttendance.filter((a: any) => normalizeStatus(a.status) === "Present").length;
    const approvedLeaves = validAttendance.filter((a: any) => normalizeStatus(a.status) === "Leave").length;
    const halfDays = validAttendance.filter((a: any) => normalizeStatus(a.status) === "Half Day").length;


    // Paid-leave conversion policy (monthly) - keep in sync with generatePayroll

    const leavesData = await fetchLeavesForMonth(emp.auth_uid, startISO, endISO);
    const leaveSummary = calculatePayrollLeaveSummary(emp, leavesData);
    const { paid_leaves_used, unpaid_leave_days } = leaveSummary;


    const perDaySalary = Number(emp.salary || 0) / workingDays;

    // Half Day
    const halfDayUnpaidEquivalent = halfDays * 0.5;

    // fullAbsentDays and deductions/net must match generatePayroll
    const fullAbsentDays = Math.max(0, workingDays - presentDays - approvedLeaves - halfDays);
    const payableDays = Math.max(
      0,
      workingDays - unpaid_leave_days - fullAbsentDays - halfDayUnpaidEquivalent
    );

    const leave_deductions = Math.round(perDaySalary * unpaid_leave_days * 100) / 100;
    const absence_deductions = Math.round(perDaySalary * (fullAbsentDays + halfDayUnpaidEquivalent) * 100) / 100;
    const deductions = leave_deductions + absence_deductions;
    const netSalary = Math.round((Number(emp.salary || 0) - deductions) * 100) / 100;

    // Salary breakdown
    const monthlySalary = Number(emp.salary);
    const yearlySalary = monthlySalary * 12;
    const basicSalary = monthlySalary * 0.50;
    const hra = monthlySalary * 0.30;
    const otherAllowances = monthlySalary * 0.20;
    const yearlyBasic = basicSalary * 12;
    const yearlyHra = hra * 12;
    const yearlyOtherAllowances = otherAllowances * 12;

    preview.push({
      auth_uid: emp.auth_uid,
      name: emp.name,
      employee_id: emp.employee_id,

      basicSalary: basicSalary,
      monthlySalary,
      yearlySalary,
      hra,
      otherAllowances,
      yearlyBasic,
      yearlyHra,
      yearlyOtherAllowances,
      workingDays,
      presentDays,
      absentDays: fullAbsentDays,
      approvedLeaves,
      holidays: holidayCount,
      deductions,
      netSalary,
      paid_leaves_used,
      unpaid_leave_days,
      leave_deductions,
      payableDays,
      status: "Paid",
    });

  }
  return { preview, workingDays, holidayCount };
}
