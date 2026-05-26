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
  await supabaseAdmin
    .from("employees")
    .update({
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
     
    })
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
  const { data: holidays } = await supabaseAdmin
    .from("holidays")
    .select("date")
    .gte("date", startISO)
    .lte("date", endISO);
  const holidayCount = (holidays ?? []).length;

  // working days in month (excl weekends)
  let workingDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) workingDays++;
  }
  workingDays -= holidayCount;
  if (workingDays < 1) workingDays = 1;

  const rows: any[] = [];
  for (const emp of emps ?? []) {
    if (!emp.auth_uid) continue; // Skip employees without auth_uid
    
    const { data: att } = await supabaseAdmin
      .from("attendance")
      .select("status")
      .eq("user_auth_uid", emp.auth_uid)
      .gte("date", startISO)
      .lte("date", endISO);
    const present = (att ?? []).filter((a: any) => a.status === "Present").length;
    const leaves = (att ?? []).filter((a: any) => a.status === "Leave").length;
    const absent = Math.max(0, workingDays - present - leaves);
    
    // Salary calculations
    const monthlySalary = Number(emp.salary);
    const yearlySalary = monthlySalary * 12;
    const basicSalary = monthlySalary * 0.50;
    const hra = monthlySalary * 0.30;
    const otherAllowances = monthlySalary * 0.20;
    const yearlyBasic = basicSalary * 12;
    const yearlyHra = hra * 12;
    const yearlyOtherAllowances = otherAllowances * 12;
    
    // Deductions and net salary
    const perDay = monthlySalary / workingDays;
    const deductions = Math.round(perDay * absent * 100) / 100;
    const net = Math.round((monthlySalary - deductions) * 100) / 100;
    
    
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
  "presentDays": present,
  "absentDays": absent,
  "approvedLeaves": leaves,

  holidays: holidayCount,
  deductions,
  "netSalary": net,
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
    .select("date")
    .gte("date", startISO)
    .lte("date", endISO);
  const holidayCount = (holidays ?? []).length;

  let workingDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) workingDays++;
  }
  workingDays -= holidayCount;
  if (workingDays < 1) workingDays = 1;

  const preview: any[] = [];
  for (const emp of emps ?? []) {
    if (!emp.auth_uid) continue; // Skip employees without auth_uid
    
    const { data: att } = await supabaseAdmin
      .from("attendance")
      .select("status")
      .eq("user_auth_uid", emp.auth_uid)
      .gte("date", startISO)
      .lte("date", endISO);
    const present = (att ?? []).filter((a: any) => a.status === "Present").length;
    const leaves = (att ?? []).filter((a: any) => a.status === "Leave").length;
    const absent = Math.max(0, workingDays - present - leaves);
    
    // Salary calculations
    const monthlySalary = Number(emp.salary);
    const yearlySalary = monthlySalary * 12;
    const basicSalary = monthlySalary * 0.50;
    const hra = monthlySalary * 0.30;
    const otherAllowances = monthlySalary * 0.20;
    const yearlyBasic = basicSalary * 12;
    const yearlyHra = hra * 12;
    const yearlyOtherAllowances = otherAllowances * 12;
    
    // Deductions and net salary
    const perDay = monthlySalary / workingDays;
    const deductions = Math.round(perDay * absent * 100) / 100;
    const net = Math.round((monthlySalary - deductions) * 100) / 100;
    
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
      presentDays: present,
      approvedLeaves: leaves,
      holidays: holidayCount,
      absentDays: absent,
      deductions,
      netSalary: net,
    });
  }
  return { preview, workingDays, holidayCount };
}
