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

// ── Functions ─────────────────────────────────────────────────────

export async function createEmployee({ data: raw }: { data: z.input<typeof createEmployeeSchema> }) {
  const data = createEmployeeSchema.parse(raw);
  await assertAdmin();

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

  // trigger creates the employees row; ensure full update
  const updatePayload: any = {
    employee_id: data.employee_id,
    name: data.name,
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

  await supabaseAdmin
    .from("employees")
    .update(updatePayload)
    .eq("auth_uid", created.user!.id);

  return { success: true };
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

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  const { data: emps } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("role", "Employee");

  // Monthly calendar working day count = non-weekend days - (non-optional non-weekend holidays)
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

  const invalidDatesSet = new Set<string>();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (day === 0 || day === 6 || holidaySet.has(iso)) invalidDatesSet.add(iso);
  }


  let workingDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) workingDays++;
  }

  if (workingDays < 1) workingDays = 1;

  const rows: any[] = [];

  for (const emp of emps ?? []) {
    if (!emp.auth_uid) continue;

    const { data: att } = await supabaseAdmin
      .from("attendance")
      .select("status")
      .eq("user_auth_uid", emp.auth_uid)
      .gte("date", startISO)
      .lte("date", endISO);

    const attendance = att ?? [];

    // valid working-day attendance only (ignore any mistaken weekend/holiday attendance)
    const validAttendance = attendance.filter((a: any) => !invalidDatesSet.has(a.date));


    const presentDays = validAttendance.filter((a: any) => a.status === "Present").length;
    const halfDays = validAttendance.filter((a: any) => a.status === "Half Day").length;
    const approvedLeaves = validAttendance.filter((a: any) => a.status === "Leave").length;


    // Paid-leave conversion policy (monthly):
    // - 1 Sick paid per month
    // - 1 Casual paid per month
    // - extras become unpaid/LWP
    // NOTE: Attendance rows for Leave do not carry leave_type/is_paid_leave; backend uses leaves table.
    const { data: leavesRows } = await supabaseAdmin
      .from("leaves")
      .select("leave_type, days_count, is_paid_leave, converted_to_lwp")
      .eq("user_auth_uid", emp.auth_uid)
      .eq("status", "Approved")
      .gte("start_date", startISO)
      .lte("end_date", endISO);

    const leaves = leavesRows ?? [];

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

    // According to requirement: one sick + one casual paid per month.
    const monthlyFreeSick = Number((emp as any).monthly_free_sick ?? 1);
    const monthlyFreeCasual = Number((emp as any).monthly_free_casual ?? 1);


    const paidSickUsed = Math.min(paidEligibleSick, monthlyFreeSick);
    const paidCasualUsed = Math.min(paidEligibleCasual, monthlyFreeCasual);

    const paid_leaves_used = paidSickUsed + paidCasualUsed;



    // Unpaid/LWP includes:
    // - unpaid/converted leaves days
    // - plus extra eligible paid leave days beyond monthly free
    const unpaidFromLeaves = leaves
      .filter((l: any) => !l.is_paid_leave || l.converted_to_lwp || l.leave_type === "Leave Without Pay")
      .reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);

    // Extra eligible paid leave that didn't fit monthly free => unpaid
    const extraEligiblePaid = Math.max(0, (paidEligibleSick + paidEligibleCasual) - paid_leaves_used);

    const unpaid_leave_days = Math.max(0, unpaidFromLeaves + extraEligiblePaid);

    const perDaySalary = Number(emp.salary || 0) / workingDays;

    // Half Day logic:
    // - Half Day = 0.5 unpaid day per half-day
    // - Full absent days exclude presentDays, approvedLeaves, and halfDays (halfDays are unpaid equivalents separately)
    const halfDayUnpaidEquivalent = halfDays * 0.5;

    // Full absent days = workingDays - presentDays - approvedLeaves - halfDays
    const fullAbsentDays = Math.max(0, workingDays - presentDays - approvedLeaves - halfDays);

    // Payable days = workingDays - unpaid_leave_days - fullAbsentDays - (halfDays * 0.5)
    const leave_deductions = Math.round(perDaySalary * unpaid_leave_days * 100) / 100;

    // Absence deduction = fullAbsentDays + (halfDays * 0.5)
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
      // Track absentDays as full-day absents only (half-days handled via unpaid equivalents)
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
  }

  if (rows.length) {
    await supabaseAdmin
      .from("payroll")
      .upsert(rows, { onConflict: "user_auth_uid,month,year" });
  }

  return { success: true, count: rows.length };
}


export async function previewPayroll({ data: raw }: { data: z.input<typeof payrollMonthSchema> }) {
  const data = payrollMonthSchema.parse(raw);
  await assertAdmin();

  const { month, year } = data;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

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

  let workingDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) workingDays++;
  }

  if (workingDays < 1) workingDays = 1;

  const holidayCount = holidaySet.size;


  const invalidDatesSet = new Set<string>();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (day === 0 || day === 6 || holidaySet.has(iso)) invalidDatesSet.add(iso);
  }

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

    const presentDays = validAttendance.filter((a: any) => a.status === "Present").length;
    const approvedLeaves = validAttendance.filter((a: any) => a.status === "Leave").length;
    const halfDays = validAttendance.filter((a: any) => a.status === "Half Day").length;


    // Paid-leave conversion policy (monthly) - keep in sync with generatePayroll

    const { data: leavesRows } = await supabaseAdmin
      .from("leaves")
      .select("leave_type, days_count, is_paid_leave, converted_to_lwp")
      .eq("user_auth_uid", emp.auth_uid)
      .eq("status", "Approved")
      .gte("start_date", startISO)
      .lte("end_date", endISO);

    const leavesData = leavesRows ?? [];

    const paidEligibleSick = leavesData
      .filter(
        (l: any) =>
          l.leave_type === "Sick Leave" &&
          l.is_paid_leave === true &&
          !l.converted_to_lwp
      )
      .reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);

    const paidEligibleCasual = leavesData
      .filter(
        (l: any) =>
          l.leave_type === "Casual Leave" &&
          l.is_paid_leave === true &&
          !l.converted_to_lwp
      )
      .reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);

    const monthlyFreeSick = Number((emp as any).monthly_free_sick ?? 1);
    const monthlyFreeCasual = Number((emp as any).monthly_free_casual ?? 1);

    const paidSickUsed = Math.min(paidEligibleSick, monthlyFreeSick);
    const paidCasualUsed = Math.min(paidEligibleCasual, monthlyFreeCasual);

    const paid_leaves_used = paidSickUsed + paidCasualUsed;



    const unpaidFromLeaves = leavesData
      .filter(
        (l: any) => !l.is_paid_leave || l.converted_to_lwp || l.leave_type === "Leave Without Pay"
      )
      .reduce((sum: number, r: any) => sum + Number(r.days_count || 0), 0);

    const extraEligiblePaid = Math.max(0, (paidEligibleSick + paidEligibleCasual) - paid_leaves_used);

    const unpaid_leave_days = Math.max(0, unpaidFromLeaves + extraEligiblePaid);


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
      presentDays: presentDays,
      absentDays: fullAbsentDays,
      approvedLeaves: approvedLeaves,
      holidays: holidayCount,
      deductions,
      netSalary: netSalary,
      paid_leaves_used,
      unpaid_leave_days,
      leave_deductions,
      payableDays,
      status: "Paid",
    });

  }
  return { preview, workingDays, holidayCount };
}
