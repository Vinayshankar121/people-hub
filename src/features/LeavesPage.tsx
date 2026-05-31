import { useEffect, useState } from "react";
import { PlaneTakeoff, Plus, Check, X, MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { fmtDate, LEAVE_TYPES, initials } from "@/lib/hrms-utils";
import { approveLeave } from "@/lib/admin.functions";
import { toast } from "sonner";

type LeaveRow = {
  id: string;
  user_auth_uid: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  admin_comment: string;
  employees?: { name: string; employee_id: string };
};


function dayCount(start: string, end: string) {
  const d = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return Math.max(1, d);
}

export function LeavesPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === "Admin" ? <AdminLeaves /> : <EmployeeLeaves profile={profile} />;
}

/* ─── Admin View ─── */
function AdminLeaves() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [rejectTarget, setRejectTarget] = useState<LeaveRow | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const load = async () => {
    const { data } = await supabase.from("leaves")
      .select("*, employees!leaves_user_auth_uid_fkey(name, employee_id)")
      .order("created_at", { ascending: false });
    setLeaves((data as LeaveRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (leaveId: string, action: "approve" | "reject", comment?: string) => {
    try {
      await approveLeave({ data: { leave_id: leaveId, action, comment } });
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      setRejectTarget(null);
      setRejectComment("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Leave Applications</h1>
        <p className="text-sm text-slate-500 mt-1">Review, approve, and manage staff leave requests.</p>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Leave Type</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Dates</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Reason</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-brand grid place-items-center text-[10px] font-semibold text-white">{initials(l.employees?.name)}</div>
                      <div>
                        <p className="font-medium text-slate-900 text-xs">{l.employees?.name ?? "—"}</p>
                        <p className="text-[10px] text-slate-500">{l.employees?.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">{l.leave_type}</span></td>
                  <td className="px-5 py-3 text-slate-600">
                    <span>{fmtDate(l.start_date)} — {fmtDate(l.end_date)}</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">({dayCount(l.start_date, l.end_date)} days)</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 max-w-[200px] truncate text-xs">{l.reason}</td>
                  <td className="px-5 py-3"><Badge status={l.status} /></td>
                  <td className="px-5 py-3">
                    {l.status === "Pending" ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleAction(l.id, "approve")} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition" title="Approve">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setRejectTarget(l)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition" title="Reject">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500"><PlaneTakeoff className="h-10 w-10 mx-auto text-slate-300 mb-2" />No leave applications found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal with comment */}
      <Modal open={!!rejectTarget} title="Reject Leave" onClose={() => { setRejectTarget(null); setRejectComment(""); }}>
        <p className="text-sm text-slate-600 mb-4">
          Rejecting leave for <strong>{rejectTarget?.employees?.name}</strong>. Optionally add a reason:
        </p>
        <textarea
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="Rejection reason (optional)…"
          rows={3}
          className="input-field resize-none w-full"
        />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => { setRejectTarget(null); setRejectComment(""); }} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={() => rejectTarget && handleAction(rejectTarget.id, "reject", rejectComment)} className="px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:opacity-90 transition">
            Reject Leave
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Employee View ─── */
function EmployeeLeaves({ profile }: { profile: any }) {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ start_date: "", end_date: "", type: "Casual Leave", reason: "" });

  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("leaves").select("*")
      .eq("user_auth_uid", profile.auth_uid)
      .order("created_at", { ascending: false });
    setLeaves((data as LeaveRow[]) ?? []);
  };

  useEffect(() => { load(); }, [profile]);

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date || !form.reason) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("leaves").insert({
        user_auth_uid: profile.auth_uid,
        start_date: form.start_date,
        end_date: form.end_date,
        leave_type: form.type,
        reason: form.reason,
        status: "Pending",
      });

      if (error) throw error;
      toast.success("Leave request submitted");
      setShowModal(false);
      setForm({ start_date: "", end_date: "", type: "Casual Leave", reason: "" });
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit leave");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Leave Applications</h1>
          <p className="text-sm text-slate-500 mt-1">Submit leaves and review approvals.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition">
          <Plus className="h-4 w-4" /> Request Leave
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                <th className="text-left px-5 py-3 font-medium text-slate-500">Leave Type</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Dates</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Reason</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">{l.leave_type}</span></td>

                  <td className="px-5 py-3 text-slate-600">
                    {fmtDate(l.start_date)} — {fmtDate(l.end_date)}
                    <span className="ml-1.5 text-[10px] text-slate-400">({dayCount(l.start_date, l.end_date)} days)</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 max-w-[250px] truncate text-xs">{l.reason}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge status={l.status} />
                      {l.status === "Rejected" && l.admin_comment && (
                        <span className="text-[10px] text-rose-600 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {l.admin_comment}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-slate-500"><PlaneTakeoff className="h-10 w-10 mx-auto text-slate-300 mb-2" />No leave applications yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      <Modal open={showModal} title="Apply for Leave" onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Start Date <span className="text-rose-500">*</span></label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">End Date <span className="text-rose-500">*</span></label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Leave Type <span className="text-rose-500">*</span></label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Reason <span className="text-rose-500">*</span></label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Explain why you require this time off…" rows={3} className="input-field resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
