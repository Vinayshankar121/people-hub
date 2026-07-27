import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";

async function getCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("Unauthorized: not signed in");
  return uid;
}

async function getUserRole(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("auth_uid", userId)
    .maybeSingle();
  return data?.role ?? "Employee";
}

async function assertAdmin() {
  const userId = await getCurrentUserId();
  const role = await getUserRole(userId);
  if (role !== "Admin") throw new Error("Forbidden: admin only");
  return userId;
}

async function assertAdminOrCeo() {
  const userId = await getCurrentUserId();
  const role = await getUserRole(userId);
  if (role !== "Admin" && role !== "CEO") throw new Error("Forbidden: admin or CEO only");
  return userId;
}

// ── Schemas ───────────────────────────────────────────────────────

const cycleSchema = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(["Draft", "Active", "Closed"]),
});

const selfAppraisalSchema = z.object({
  id: z.string().uuid().optional(),
  appraisal_cycle: z.string().min(1),
  achievements: z.string().optional().nullable(),
  projects_worked: z.string().optional().nullable(),
  skills_learned: z.string().optional().nullable(),
  certifications: z.string().optional().nullable(),
  challenges_faced: z.string().optional().nullable(),
  suggestions: z.string().optional().nullable(),
  future_goals: z.string().optional().nullable(),
  self_rating: z.number().min(1).max(5),
  status: z.enum(["Draft", "Self Submitted"]),
});

const adminReviewSchema = z.object({
  id: z.string().uuid(),
  strengths: z.string().optional().nullable(),
  areas_for_improvement: z.string().optional().nullable(),
  admin_comments: z.string().optional().nullable(),
  admin_rating: z.number().min(1).max(5),
  admin_increment_percentage: z.number().min(0),
  admin_increment_amount: z.number().min(0),
  admin_proposed_salary: z.number().min(0),
  recommendation_type: z.string(),
  status: z.enum(["Admin Reviewed", "Send Back", "Rejected"]),
});

const ceoDecisionSchema = z.object({
  id: z.string().uuid(),
  ceo_comments: z.string().optional().nullable(),
  ceo_increment_percentage: z.number().min(0),
  ceo_increment_amount: z.number().min(0),
  ceo_proposed_salary: z.number().min(0),
  ceo_effective_date: z.string(), // YYYY-MM-DD
  ceo_decision: z.enum(["Approved", "Rejected"]),
});

const fetchAdminSchema = z.object({
  search: z.string().optional().default(""),
  status: z.string().optional(),
  appraisal_cycle: z.string().optional(),
  effective_year: z.number().optional(),
});

function toDateOnly(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

// ── Appraisal Cycles ──────────────────────────────────────────────

export async function fetchAppraisalCycles() {
  const { data, error } = await supabase
    .from("appraisal_cycles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAppraisalCycle({ data: raw }: { data: z.input<typeof cycleSchema> }) {
  const data = cycleSchema.parse(raw);
  await assertAdminOrCeo();

  const { data: inserted, error } = await supabaseAdmin
    .from("appraisal_cycles")
    .insert({ name: data.name, status: data.status })
    .select("*")
    .single();

  if (error) throw error;
  return inserted;
}

export async function updateAppraisalCycle({ id, status }: { id: string; status: "Draft" | "Active" | "Closed" }) {
  await assertAdminOrCeo();
  const { data: updated, error } = await supabaseAdmin
    .from("appraisal_cycles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return updated;
}

// ── Appraisals CRUD ───────────────────────────────────────────────

export async function fetchAdminAppraisals(raw: { search?: string; status?: string; appraisal_cycle?: string; effective_year?: number }) {
  const params = fetchAdminSchema.parse(raw);
  const userId = await assertAdminOrCeo();
  const role = await getUserRole(userId);

  let q = supabaseAdmin
    .from("appraisals")
    .select("*");

  // CEO should only view non-Draft appraisals unless they want to see everything
  if (role === "CEO") {
    q = q.neq("status", "Draft");
  }

  if (params.status) q = q.eq("status", params.status);
  if (params.appraisal_cycle) q = q.eq("appraisal_cycle", params.appraisal_cycle);
  if (params.effective_year) {
    const y = params.effective_year;
    q = q.gte("effective_from", `${y}-01-01`).lte("effective_from", `${y}-12-31`);
  }

  if (params.search?.trim()) {
    const s = params.search.trim();
    q = q.or(`employee_name.ilike.%${s}%,employee_id.ilike.%${s}%`);
  }

  const { data, error } = await q.order("updated_at", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return { appraisals: data ?? [] };
}

export async function fetchEmployeeAppraisals() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("appraisals")
    .select("*")
    .eq("employee_auth_uid", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Save or submit employee self appraisal
export async function saveSelfAppraisal({ data: raw }: { data: z.input<typeof selfAppraisalSchema> }) {
  const data = selfAppraisalSchema.parse(raw);
  const userId = await getCurrentUserId();

  // Fetch current employee details
  const { data: emp, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("employee_id, name, salary")
    .eq("auth_uid", userId)
    .single();

  if (empErr) throw new Error("Failed to load employee profile: " + empErr.message);

  const payload: any = {
    employee_auth_uid: userId,
    employee_id: emp.employee_id,
    employee_name: emp.name,
    appraisal_cycle: data.appraisal_cycle,
    current_salary: Number(emp.salary || 0),
    proposed_salary: Number(emp.salary || 0),
    increment_percentage: 0,
    
    projects_worked: data.projects_worked ?? null,
    skills_learned: data.skills_learned ?? null,
    certifications: data.certifications ?? null,
    challenges_faced: data.challenges_faced ?? null,
    suggestions: data.suggestions ?? null,
    future_goals: data.future_goals ?? null,
    self_rating: data.self_rating,
    
    status: data.status,
    updated_at: new Date().toISOString(),
  };

  if (data.id) {
    // Check ownership and editability
    const { data: existing } = await supabaseAdmin
      .from("appraisals")
      .select("id, status, employee_auth_uid")
      .eq("id", data.id)
      .single();

    if (!existing) throw new Error("Appraisal not found");
    if (existing.employee_auth_uid !== userId) throw new Error("Unauthorized to edit this appraisal");
    if (existing.status !== "Draft" && existing.status !== "Send Back") {
      throw new Error("Only drafts or sent back appraisals can be edited");
    }

    const { data: updated, error } = await supabaseAdmin
      .from("appraisals")
      .update(payload)
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;
    return updated;
  } else {
    // Create new
    payload.created_by = userId;
    payload.effective_from = toDateOnly(new Date().toISOString()); // default effective date

    const { data: inserted, error } = await supabaseAdmin
      .from("appraisals")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return inserted;
  }
}

// Admin reviews and recommends
export async function adminReviewAppraisal({ data: raw }: { data: z.input<typeof adminReviewSchema> }) {
  const data = adminReviewSchema.parse(raw);
  const adminId = await assertAdmin();

  const { data: existing } = await supabaseAdmin
    .from("appraisals")
    .select("*")
    .eq("id", data.id)
    .single();

  if (!existing) throw new Error("Appraisal not found");
  if (existing.status !== "Self Submitted" && existing.status !== "Admin Reviewed") {
    throw new Error("Appraisal is not in reviewable state by Admin");
  }

  const payload: any = {
    strengths: data.strengths ?? null,
    areas_for_improvement: data.areas_for_improvement ?? null,
    admin_comments: data.admin_comments ?? null,
    admin_rating: data.admin_rating,
    admin_increment_percentage: Number(data.admin_increment_percentage),
    admin_increment_amount: Number(data.admin_increment_amount),
    admin_proposed_salary: Number(data.admin_proposed_salary),
    recommendation_type: data.recommendation_type,
    status: data.status,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabaseAdmin
    .from("appraisals")
    .update(payload)
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw error;

  // Notify employee if sent back or rejected
  if (data.status === "Send Back" || data.status === "Rejected") {
    try {
      await supabaseAdmin.from("notifications").insert({
        user_auth_uid: existing.employee_auth_uid,
        title: `Appraisal Status Update: ${data.status}`,
        message: `Your appraisal for cycle "${existing.appraisal_cycle}" has been updated to "${data.status}". Feedback: ${data.admin_comments ?? ""}`,
        type: "AppraisalStatus",
        is_read: false,
      });
    } catch (_) {}
  }

  return updated;
}

// CEO Approval Flow
export async function ceoApproveAppraisal({ data: raw }: { data: z.input<typeof ceoDecisionSchema> }) {
  const data = ceoDecisionSchema.parse(raw);
  const ceoId = await getCurrentUserId();
  const role = await getUserRole(ceoId);
  if (role !== "CEO") throw new Error("Forbidden: CEO only");

  const { data: existing } = await supabaseAdmin
    .from("appraisals")
    .select("*")
    .eq("id", data.id)
    .single();

  if (!existing) throw new Error("Appraisal not found");
  if (existing.status !== "Admin Reviewed") {
    throw new Error("Appraisal must be reviewed by Admin first");
  }

  const isApproved = data.ceo_decision === "Approved";
  const payload: any = {
    ceo_comments: data.ceo_comments ?? null,
    ceo_increment_percentage: Number(data.ceo_increment_percentage),
    ceo_increment_amount: Number(data.ceo_increment_amount),
    ceo_proposed_salary: Number(data.ceo_proposed_salary),
    ceo_effective_date: data.ceo_effective_date,
    ceo_decision: data.ceo_decision,
    status: isApproved ? "CEO Approved" : "Rejected",
    
    // update primary proposal details to match CEO decision
    proposed_salary: Number(data.ceo_proposed_salary),
    increment_percentage: Number(data.ceo_increment_percentage),
    effective_from: data.ceo_effective_date,
    approved_by: ceoId,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabaseAdmin
    .from("appraisals")
    .update(payload)
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw error;

  // Notify employee and admin
  try {
    await supabaseAdmin.from("notifications").insert({
      user_auth_uid: existing.employee_auth_uid,
      title: isApproved ? "Appraisal Approved by CEO" : "Appraisal Rejected by CEO",
      message: isApproved 
        ? `Congratulations! Your appraisal has been approved by the CEO with revised salary ₹${Number(data.ceo_proposed_salary).toLocaleString("en-IN")} effective from ${data.ceo_effective_date}.`
        : `Your appraisal has been marked as Rejected by the CEO. Comments: ${data.ceo_comments ?? ""}`,
      type: "AppraisalCEOStatus",
      is_read: false,
    });
  } catch (_) {}

  return updated;
}

// Finalize Salary Revision (Updates employees base salary and marks appraisal as Completed)
export async function finalizeSalaryRevision({ id }: { id: string }) {
  const ceoId = await getCurrentUserId();
  const role = await getUserRole(ceoId);
  if (role !== "CEO") throw new Error("Forbidden: CEO only");

  const { data: existing } = await supabaseAdmin
    .from("appraisals")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) throw new Error("Appraisal not found");
  if (existing.status !== "CEO Approved") {
    throw new Error("Only CEO Approved appraisals can be finalized");
  }

  // Update employee salary
  const { error: empError } = await supabaseAdmin
    .from("employees")
    .update({
      salary: Number(existing.ceo_proposed_salary),
      updated_at: new Date().toISOString()
    })
    .eq("auth_uid", existing.employee_auth_uid);

  if (empError) throw new Error("Failed to update employee salary: " + empError.message);

  // Update appraisal status to Completed
  const { data: updated, error: appError } = await supabaseAdmin
    .from("appraisals")
    .update({
      status: "Completed",
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("*")
    .single();

  if (appError) throw appError;

  // Notify employee
  try {
    await supabaseAdmin.from("notifications").insert({
      user_auth_uid: existing.employee_auth_uid,
      title: "Salary Revision Finalized",
      message: `Your revised salary of ₹${Number(existing.ceo_proposed_salary).toLocaleString("en-IN")} has been finalized and updated in the system.`,
      type: "SalaryRevisionFinalized",
      is_read: false,
    });
  } catch (_) {}

  return updated;
}

// ── Legacy Compatibility Wrappers ─────────────────────────────────

export async function createAppraisalDraft({ data: raw }: { data: any }) {
  return saveSelfAppraisal({ data: { ...raw, status: "Draft" } });
}

export async function updateAppraisal({ data: raw }: { data: any }) {
  return saveSelfAppraisal({ data: { ...raw, status: "Draft" } });
}

export async function submitAppraisal({ data: raw }: { data: { id: string } }) {
  const { data: existing } = await supabaseAdmin
    .from("appraisals")
    .select("appraisal_cycle")
    .eq("id", raw.id)
    .single();
  
  if (!existing) throw new Error("Appraisal not found");
  
  return saveSelfAppraisal({
    data: {
      id: raw.id,
      appraisal_cycle: existing.appraisal_cycle,
      status: "Self Submitted",
      self_rating: 3, // fallback default
    } as any
  });
}

export async function approveAppraisal({ data: raw }: { data: { id: string; approved_by: string; approved_at: string } }) {
  // Aliases to adminReviewAppraisal for legacy compatibility
  return adminReviewAppraisal({
    data: {
      id: raw.id,
      admin_rating: 4, // default rating
      admin_increment_percentage: 0,
      admin_increment_amount: 0,
      admin_proposed_salary: 0,
      recommendation_type: "Salary Increment",
      status: "Admin Reviewed",
    }
  });
}

export async function rejectAppraisal({ data: raw }: { data: { id: string } }) {
  return adminReviewAppraisal({
    data: {
      id: raw.id,
      admin_rating: 1,
      admin_increment_percentage: 0,
      admin_increment_amount: 0,
      admin_proposed_salary: 0,
      recommendation_type: "No Change",
      status: "Rejected",
    }
  });
}

// ── Deletion Handlers ──────────────────────────────────────────────

export async function deleteAppraisalCycle({ id }: { id: string }) {
  await assertAdminOrCeo();
  const { error } = await supabaseAdmin
    .from("appraisal_cycles")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

export async function deleteAppraisalRecord({ id }: { id: string }) {
  const userId = await getCurrentUserId();
  const role = await getUserRole(userId);

  if (role === "Employee") {
    const { data: existing } = await supabaseAdmin
      .from("appraisals")
      .select("employee_auth_uid")
      .eq("id", id)
      .maybeSingle();

    if (!existing || existing.employee_auth_uid !== userId) {
      throw new Error("Unauthorized to delete this appraisal");
    }
  }

  const { error } = await supabaseAdmin
    .from("appraisals")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}
