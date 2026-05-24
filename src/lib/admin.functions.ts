import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(ctx: { userId: string }) {
  const { data } = await supabaseAdmin
    .from("employees").select("role").eq("auth_uid", ctx.userId).maybeSingle();
  if (data?.role !== "Admin") throw new Error("Forbidden: admin only");
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
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
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const password = data.password || `${data.employee_id}@123`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: {
        name: data.name, employee_id: data.employee_id, role: data.role,
        department: data.department, designation: data.designation,
        salary: data.salary, phone: data.phone, joiningDate: data.joiningDate,
      },
    });
    if (error) throw new Error(error.message);
    // trigger creates the employees row; ensure full update
    await supabaseAdmin.from("employees").update({
      employee_id: data.employee_id, name: data.name, department: data.department,
      designation: data.designation, salary: data.salary, phone: data.phone,
      role: data.role, joiningDate: data.joiningDate ?? new Date().toISOString(),
    }).eq("auth_uid", created.user!.id);
    return { success: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ auth_uid: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.auth_uid === context.userId) throw new Error("Cannot delete yourself");
    await supabaseAdmin.auth.admin.deleteUser(data.auth_uid);
    return { success: true };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      auth_uid: z.string().uuid(),
      name: z.string().min(1),
      department: z.string(),
      designation: z.string(),
      salary: z.number(),
      phone: z.string(),
      role: z.enum(["Admin", "Employee"]),
      joiningDate: z.string().optional(),
      password: z.string().min(6).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { auth_uid, password, ...patch } = data;
    if (password) await supabaseAdmin.auth.admin.updateUserById(auth_uid, { password });
    await supabaseAdmin.from("employees").update(patch).eq("auth_uid", auth_uid);
    return { success: true };
  });

export const approveLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      leave_id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      comment: z.string().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: leave } = await supabaseAdmin.from("leaves").select("*").eq("id", data.leave_id).single();
    if (!leave) throw new Error("Leave not found");
    const status = data.action === "approve" ? "Approved" : "Rejected";
    await supabaseAdmin.from("leaves").update({ status, admin_comment: data.comment ?? "" }).eq("id", data.leave_id);

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
            user_auth_uid: leave.user_auth_uid, date: iso, status: "Leave",
            approval_status: "Approved",
          });
        }
        d.setDate(d.getDate() + 1);
      }
      if (rows.length) {
        await supabaseAdmin.from("attendance").upsert(rows, { onConflict: "user_auth_uid,date" });
      }
    }
    return { success: true };
  });

export const reviewAttendanceEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.action === "approve") {
      await supabaseAdmin.from("attendance").update({
        approval_status: "Approved", edit_requested: false,
        approved_by: context.userId, approved_at: new Date().toISOString(),
      }).eq("id", data.id);
    } else {
      const { data: row } = await supabaseAdmin.from("attendance").select("*").eq("id", data.id).single();
      if (row) {
        await supabaseAdmin.from("attendance").update({
          approval_status: "Rejected", edit_requested: false,
          punch_in_time: row.original_punch_in, punch_out_time: row.original_punch_out,
        }).eq("id", data.id);
      }
    }
    return { success: true };
  });

export const generatePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2000).max(3000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { month, year } = data;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    const { data: emps } = await supabaseAdmin.from("employees").select("*").eq("role", "Employee");
    const { data: holidays } = await supabaseAdmin.from("holidays")
      .select("date").gte("date", startISO).lte("date", endISO);
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
      const { data: att } = await supabaseAdmin.from("attendance")
        .select("status").eq("user_auth_uid", emp.auth_uid).gte("date", startISO).lte("date", endISO);
      const present = (att ?? []).filter((a: any) => a.status === "Present").length;
      const leaves = (att ?? []).filter((a: any) => a.status === "Leave").length;
      const absent = Math.max(0, workingDays - present - leaves);
      const perDay = Number(emp.salary) / workingDays;
      const deductions = Math.round(perDay * absent * 100) / 100;
      const net = Math.round((Number(emp.salary) - deductions) * 100) / 100;
      rows.push({
        user_auth_uid: emp.auth_uid, month, year,
        basicSalary: emp.salary, workingDays, presentDays: present,
        absentDays: absent, approvedLeaves: leaves, holidays: holidayCount,
        deductions, netSalary: net, status: "Paid",
      });
    }
    if (rows.length) {
      await supabaseAdmin.from("payroll").upsert(rows, { onConflict: "user_auth_uid,month,year" });
    }
    return { success: true, count: rows.length };
  });

export const previewPayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { month, year } = data;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    const { data: emps } = await supabaseAdmin.from("employees").select("*").eq("role", "Employee");
    const { data: holidays } = await supabaseAdmin.from("holidays").select("date").gte("date", startISO).lte("date", endISO);
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
      const { data: att } = await supabaseAdmin.from("attendance").select("status")
        .eq("user_auth_uid", emp.auth_uid).gte("date", startISO).lte("date", endISO);
      const present = (att ?? []).filter((a: any) => a.status === "Present").length;
      const leaves = (att ?? []).filter((a: any) => a.status === "Leave").length;
      const absent = Math.max(0, workingDays - present - leaves);
      const perDay = Number(emp.salary) / workingDays;
      const deductions = Math.round(perDay * absent * 100) / 100;
      const net = Math.round((Number(emp.salary) - deductions) * 100) / 100;
      preview.push({
        auth_uid: emp.auth_uid, name: emp.name, employee_id: emp.employee_id,
        basicSalary: emp.salary, workingDays, presentDays: present,
        approvedLeaves: leaves, holidays: holidayCount, absentDays: absent,
        deductions, netSalary: net,
      });
    }
    return { preview, workingDays, holidayCount };
  });
