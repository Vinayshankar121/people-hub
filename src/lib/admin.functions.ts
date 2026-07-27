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
  status: z.enum(["Active", "Inactive"]).default("Active"),

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
  status: z.enum(["Active", "Inactive"]).optional(),
  is_active: z.boolean().optional(),
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

function getDisabledWeekdaysFromSettings(): Set<number> {
  const disabled = new Set<number>([0]); // Sunday default
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("hrms_org_settings_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        const daysMap: Record<string, number> = {
          Sunday: 0,
          Monday: 1,
          Tuesday: 2,
          Wednesday: 3,
          Thursday: 4,
          Friday: 5,
          Saturday: 6,
        };
        if (parsed?.attendance?.workingDays) {
          Object.entries(parsed.attendance.workingDays).forEach(([dayName, isWorking]) => {
            if (!isWorking && daysMap[dayName] !== undefined) {
              disabled.add(daysMap[dayName]);
            }
          });
        }
      }
    }
  } catch (e) {}
  return disabled;
}

function makePayrollDaySets(start: Date, end: Date, holidaySet: Set<string>) {
  const disabledWeekdays = getDisabledWeekdaysFromSettings();
  const invalidDatesSet = new Set<string>();
  let workingDays = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    const iso = toISODateUTC(d);
    if (disabledWeekdays.has(day) || holidaySet.has(iso)) invalidDatesSet.add(iso);
    if (!disabledWeekdays.has(day) && !holidaySet.has(iso)) workingDays++;
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

function parseMissingColumns(message: string) {
  const normalized = String(message ?? "");
  const columns = new Set<string>();

  const patterns = [
    /'([^']+)'\s+column\s+of\s+'([^']+)'/i,
    /column\s+"([^"]+)"\s+of relation/i,
    /column\s+([a-zA-Z0-9_]+)\s+does not exist/i,
    /undefined column\s+([a-zA-Z0-9_]+)/i,
    /missing column[s]?\s*[: ]+([a-zA-Z0-9_,\s]+)/i,
  ] as RegExp[];

  for (const pattern of patterns) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null;

    while ((match = globalPattern.exec(normalized)) !== null) {
      const raw = match[1] ?? "";
      if (!raw) continue;
      raw.split(",").forEach((part) => {
        const columnName = part.trim().replace(/^"|"$/g, "");
        if (columnName) columns.add(columnName);
      });

      if (match[0].length === 0) {
        globalPattern.lastIndex += 1;
      }
    }
  }

  const keywordFallbacks = ["is_active", "appraisalApplied", "appraisalEffectiveFrom"];
  keywordFallbacks.forEach((column) => {
    if (normalized.toLowerCase().includes(column.toLowerCase())) {
      columns.add(column);
    }
  });

  return Array.from(columns);
}

async function safeUpsertPayrollRows(rows: any[]) {
  const attemptUpsert = async (payload: any[]) => {
    const { error } = await supabaseAdmin
      .from("payroll")
      .upsert(payload, { onConflict: "user_auth_uid,month,year" });
    return error;
  };

  const getMessage = (err: any) => {
    if (!err) return "";
    return String(err.message ?? err.details ?? err.hint ?? err);
  };

  const sanitizePayrollRowsForIntegerFields = (rowsToSanitize: any[]) => {
    return rowsToSanitize.map((row) => {
      const cleaned: any = { ...row };
      const integerFields = [
        "presentDays",
        "absentDays",
        "workingDays",
        "approvedLeaves",
        "holidays",
        "paid_leaves_used",
        "unpaid_leave_days",
        "payable_days",
        "paid_leaves",
        "unpaid_leaves",
        "unpaid_leaves_count",
        "free_leaves_remaining",
      ];

      for (const field of integerFields) {
        const value = cleaned[field];
        if (value !== undefined && value !== null && typeof value === "number") {
          cleaned[field] = Math.round(value);
        }
      }
      return cleaned;
    });
  };

  // First try upserting with rounded integer fields
  let error = await attemptUpsert(sanitizePayrollRowsForIntegerFields(rows));
  if (!error) return;

  const message = getMessage(error);
  const missingColumns = parseMissingColumns(message);

  if (missingColumns.length === 0) {
    throw new Error("Failed saving payroll rows: " + message);
  }

  const filteredRows = rows.map((row) => {
    const cleaned: any = { ...row };
    for (const column of missingColumns) {
      delete cleaned[column];
    }
    return cleaned;
  });

  let retryError = await attemptUpsert(sanitizePayrollRowsForIntegerFields(filteredRows));
  if (!retryError) return;

  const retryMessage = getMessage(retryError);
  const retryMissingColumns = parseMissingColumns(retryMessage);
  if (retryMissingColumns.length > 0) {
    const retryFilteredRows = filteredRows.map((row) => {
      const cleaned: any = { ...row };
      for (const column of retryMissingColumns) {
        delete cleaned[column];
      }
      return cleaned;
    });
    const finalError = await attemptUpsert(sanitizePayrollRowsForIntegerFields(retryFilteredRows));
    if (!finalError) return;
    throw new Error("Failed saving payroll rows after removing unsupported columns: " + getMessage(finalError));
  }

  throw new Error("Failed saving payroll rows after removing unsupported columns: " + retryMessage);
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
  const isInactive = data.status === "Inactive";
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
      status: data.status,
      is_active: !isInactive,

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
  if (isInactive) {
    await supabaseAdmin.auth.admin.updateUserById(authUid, {
      ban_duration: "876600h",
    }).catch(() => null);
  }

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
    is_active: !isInactive,
    status: data.status,

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
    const message = String(upsertError.message ?? upsertError.details ?? upsertError.hint ?? upsertError);
    const missingColumns = parseMissingColumns(message);
    if (missingColumns.length > 0) {
      const fallbackPayload: any = { ...payload };
      for (const column of missingColumns) {
        delete fallbackPayload[column];
      }
      const { error: fallbackError } = await supabaseAdmin
        .from("employees")
        .upsert(fallbackPayload, { onConflict: "auth_uid" });
      if (!fallbackError) {
        return { success: true, auth_uid: authUid };
      }
    }

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

  const targetStatus = patch.status ?? (patch.is_active === false ? "Inactive" : patch.is_active === true ? "Active" : undefined);
  const isInactive = targetStatus === "Inactive";

  // Update Supabase Auth user metadata & ban status if changing status or details
  try {
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(auth_uid);
    const existingMetadata = authUserData?.user?.user_metadata ?? {};
    const authPayload: any = {
      user_metadata: {
        ...existingMetadata,
        name: patch.name ?? existingMetadata.name,
        role: patch.role ?? existingMetadata.role,
        department: patch.department ?? existingMetadata.department,
        designation: patch.designation ?? existingMetadata.designation,
        salary: patch.salary ?? existingMetadata.salary,
        phone: patch.phone ?? existingMetadata.phone,
        ...(targetStatus !== undefined ? { status: targetStatus, is_active: !isInactive } : {}),
      },
    };
    if (password) {
      authPayload.password = password;
    }
    if (targetStatus !== undefined) {
      authPayload.ban_duration = isInactive ? "876600h" : "none";
    }
    await supabaseAdmin.auth.admin.updateUserById(auth_uid, authPayload);
  } catch (err) {
    console.warn("[updateEmployee] Failed syncing Auth user:", err);
  }

  // Normalize optional date strings -> undefined so DB defaults apply
  const normalized: any = { ...patch };
  if (targetStatus !== undefined) {
    normalized.status = targetStatus;
    normalized.is_active = !isInactive;
  }
  if (normalized.date_of_birth === "") normalized.date_of_birth = undefined;
  if (normalized.original_hire_date === "") normalized.original_hire_date = undefined;
  if (normalized.joiningDate === "") normalized.joiningDate = undefined;

  const { error } = await supabaseAdmin.from("employees").update(normalized).eq("auth_uid", auth_uid);
  if (error) {
    const message = String(error.message ?? error.details ?? error.hint ?? error);
    const missingColumns = parseMissingColumns(message);
    if (missingColumns.length > 0) {
      const fallback: any = { ...normalized };
      for (const column of missingColumns) {
        delete fallback[column];
      }
      await supabaseAdmin.from("employees").update(fallback).eq("auth_uid", auth_uid);
      return;
    }
    throw error;
  }
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
      let status = "Half Day";
      if (row.punch_in_time && row.punch_in_time <= "09:15" && row.punch_out_time && row.punch_out_time >= "18:00") {
        status = "Present";
      } else if (row.punch_in_time && row.punch_in_time <= "09:15" && row.punch_out_time && row.punch_out_time < "18:00") {
        status = "Half Day";
      } else {
        status = "Absent";
      }

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
      let status = "Half Day";
      if (row.original_punch_in && row.original_punch_in <= "09:15" && row.original_punch_out && row.original_punch_out >= "18:00") {
        status = "Present";
      } else if (row.original_punch_in && row.original_punch_in <= "09:15" && row.original_punch_out && row.original_punch_out < "18:00") {
        status = "Half Day";
      } else {
        status = "Absent";
      }

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
  hasApprovedLeave: boolean,
  lateThreshold = "09:15",
  endTime = "18:00"
): "Present" | "Half Day" | "Absent" | "Leave" {
  if (hasApprovedLeave) {
    return "Leave";
  }
  if (!attRecord) {
    return "Absent";
  }

  // If edit request is pending admin approval, treat as Absent until approved
  if (attRecord.edit_requested && attRecord.approval_status === "Pending") {
    return "Absent";
  }

  const inTime = attRecord.punch_in_time ? String(attRecord.punch_in_time).trim() : "";
  const outTime = attRecord.punch_out_time ? String(attRecord.punch_out_time).trim() : "";

  // If employee forgot to punch out (missing punch_out_time), treat as Absent
  if (!inTime || !outTime) {
    const dbStatus = String(attRecord.status ?? "").trim().toUpperCase();
    if (dbStatus === "LEAVE" && attRecord.approval_status === "Approved") {
      return "Leave";
    }
    return "Absent";
  }

  // Both punch_in_time and punch_out_time exist
  if (inTime <= lateThreshold && outTime >= endTime) {
    return "Present";
  } else if (inTime <= lateThreshold && outTime < endTime) {
    return "Half Day";
  }

  return "Absent";
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

  const standardHoursPerDay = 8;
  const totalRequiredHours = workingDays * standardHoursPerDay;

  let presentDays = 0;
  let halfDays = 0;
  let approvedLeaveDays = 0;
  let absentDays = 0;
  let totalActualHoursWorked = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = toISODateUTC(d);
    if (invalidDatesSet.has(iso)) continue;

    const attRecord = attendanceMap.get(iso);
    const hasApprovedLeaveTable = isDateCoveredByApprovedLeave(iso);

    const computedStatus = getDynamicAttendanceStatus(attRecord, hasApprovedLeaveTable);

    if (computedStatus === "Present") {
      presentDays++;
      const h = attRecord?.total_hours ? Number(attRecord.total_hours) : standardHoursPerDay;
      totalActualHoursWorked += (h > 0 ? h : standardHoursPerDay);
    } else if (computedStatus === "Half Day") {
      halfDays++;
      presentDays += 0.5;
      absentDays += 0.5;
      const h = attRecord?.total_hours ? Number(attRecord.total_hours) : 4;
      totalActualHoursWorked += (h > 0 ? h : 4);
    } else if (computedStatus === "Leave") {
      approvedLeaveDays++;
    } else if (computedStatus === "Absent") {
      absentDays++;
    }
  }

  const freeLeavesLimit = 2;
  const paidLeavesUsed = Math.min(approvedLeaveDays, freeLeavesLimit);
  const lopDays = Math.max(0, approvedLeaveDays - freeLeavesLimit);
  const paidLeaveHours = paidLeavesUsed * standardHoursPerDay;
  const totalEffectiveHours = totalActualHoursWorked + paidLeaveHours;
  const deductionHours = Math.max(0, totalRequiredHours - totalEffectiveHours);

  return {
    workingDays,
    presentDays,
    halfDays,
    approvedLeaves: approvedLeaveDays,
    paidLeaves: paidLeavesUsed,
    unpaidLeaves: lopDays,
    absentDays,
    totalActualHoursWorked,
    totalRequiredHours,
    deductionHours,
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
  const standardHoursPerDay = 8;
  const totalRequiredHours = workingDays * standardHoursPerDay;

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
      let totalActualHoursWorked = 0;

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = toISODateUTC(d);
        if (invalidDatesSet.has(iso)) continue; // Skip weekends and holidays

        const attRecord = attendanceMap.get(iso);
        const hasApprovedLeaveTable = isDateCoveredByApprovedLeave(iso);

        const computedStatus = getDynamicAttendanceStatus(attRecord, hasApprovedLeaveTable);

        if (computedStatus === "Present") {
          presentDays++;
          const h = attRecord?.total_hours ? Number(attRecord.total_hours) : standardHoursPerDay;
          totalActualHoursWorked += (h > 0 ? h : standardHoursPerDay);
        } else if (computedStatus === "Half Day") {
          halfDays++;
          presentDays += 0.5;
          absentDays += 0.5;
          const h = attRecord?.total_hours ? Number(attRecord.total_hours) : 4;
          totalActualHoursWorked += (h > 0 ? h : 4);
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
      const paidLeaveHours = paidLeavesUsed * standardHoursPerDay;
      const totalEffectiveHours = totalActualHoursWorked + paidLeaveHours;
      const deductionHours = Math.max(0, totalRequiredHours - totalEffectiveHours);

      const { activeSalary, appraisalApplied, appraisalEffectiveFrom } = await getActiveSalaryForPeriod(
        emp, start, end, workingDays, invalidDatesSet
      );

      const perHourSalary = Math.round((activeSalary / totalRequiredHours) * 100) / 100;
      const salaryDeduction = Math.round(deductionHours * perHourSalary * 100) / 100;
      const netSalary = Math.max(0, Math.round((activeSalary - salaryDeduction) * 100) / 100);
      const perDaySalary = Math.round((activeSalary / workingDays) * 100) / 100;

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
        deductions: salaryDeduction,
        leave_deductions: Math.round(lopDays * perDaySalary * 100) / 100,
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
  const standardHoursPerDay = 8;
  const totalRequiredHours = workingDays * standardHoursPerDay;

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
    let totalActualHoursWorked = 0;

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = toISODateUTC(d);
      if (invalidDatesSet.has(iso)) continue;

      const attRecord = attendanceMap.get(iso);
      const hasApprovedLeaveTable = isDateCoveredByApprovedLeave(iso);

      const computedStatus = getDynamicAttendanceStatus(attRecord, hasApprovedLeaveTable);

      if (computedStatus === "Present") {
        presentDays++;
        const h = attRecord?.total_hours ? Number(attRecord.total_hours) : standardHoursPerDay;
        totalActualHoursWorked += (h > 0 ? h : standardHoursPerDay);
      } else if (computedStatus === "Half Day") {
        halfDays++;
        presentDays += 0.5;
        absentDays += 0.5;
        const h = attRecord?.total_hours ? Number(attRecord.total_hours) : 4;
        totalActualHoursWorked += (h > 0 ? h : 4);
      } else if (computedStatus === "Leave") {
        approvedLeaveDays++;
      } else if (computedStatus === "Absent") {
        absentDays++;
      }
    }

    const freeLeavesLimit = 2;
    const paidLeavesUsed = Math.min(approvedLeaveDays, freeLeavesLimit);
    const lopDays = Math.max(0, approvedLeaveDays - freeLeavesLimit);
    const paidLeaveHours = paidLeavesUsed * standardHoursPerDay;
    const totalEffectiveHours = totalActualHoursWorked + paidLeaveHours;
    const deductionHours = Math.max(0, totalRequiredHours - totalEffectiveHours);

    const { activeSalary, appraisalApplied, appraisalEffectiveFrom } = await getActiveSalaryForPeriod(
      emp, start, end, workingDays, invalidDatesSet
    );

    const perHourSalary = Math.round((activeSalary / totalRequiredHours) * 100) / 100;
    const salaryDeduction = Math.round(deductionHours * perHourSalary * 100) / 100;
    const netSalary = Math.max(0, Math.round((activeSalary - salaryDeduction) * 100) / 100);
    const perDaySalary = Math.round((activeSalary / workingDays) * 100) / 100;
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
      totalActualHoursWorked,
      totalRequiredHours,
      deductionHours,
      perHourSalary,
      deductions: salaryDeduction,
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
