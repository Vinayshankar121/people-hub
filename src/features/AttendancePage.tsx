import { useEffect, useState } from "react";
import { CalendarCheck, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { fmtDate, todayISO, calcHours, initials } from "@/lib/hrms-utils";
import { reviewAttendanceEdit } from "@/lib/admin.functions";
import { toast } from "sonner";

type AttRow = {
  id: string;
  user_auth_uid: string;
  date: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  status: string;
  approval_status: string;
  edit_requested: boolean;
  original_punch_in: string;
  original_punch_out: string;
  remarks: string;
  employees?: { name: string; employee_id: string };
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function AttendancePage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === "Admin" ? <AdminAttendance /> : <EmployeeAttendance profile={profile} />;
}

/* ─── Admin View ─── */
function AdminAttendance() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<AttRow[]>([]);
  const [pending, setPending] = useState<AttRow[]>([]);
  const [employees, setEmployees] = useState<{ auth_uid: string; name: string; employee_id: string }[]>([]);
  const [empFilter, setEmpFilter] = useState("All");

  const loadAll = async () => {
    const { data: emps } = await supabase.from("employees").select("auth_uid, name, employee_id");
    setEmployees((emps ?? []) as any);

    let q = supabase.from("attendance").select("*, employees!attendance_user_auth_uid_fkey(name, employee_id)").eq("date", date);
    if (empFilter !== "All") q = q.eq("user_auth_uid", empFilter);
    const { data } = await q.order("date", { ascending: false });
    setRows((data as AttRow[]) ?? []);

    const { data: pen } = await supabase.from("attendance")
      .select("*, employees!attendance_user_auth_uid_fkey(name, employee_id)")
      .eq("edit_requested", true)
      .eq("approval_status", "Pending");
    setPending((pen as AttRow[]) ?? []);
  };

  useEffect(() => { loadAll(); }, [date, empFilter]);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    try {
      await reviewAttendanceEdit({ data: { id, action } });
      toast.success(action === "approve" ? "Correction approved" : "Correction rejected");
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Track check-ins, worked hours, and employee logs.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
        <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
          <option value="All">All Employees</option>
          {employees.map((em) => <option key={em.auth_uid} value={em.auth_uid}>{em.name} ({em.employee_id})</option>)}
        </select>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                <th className="text-left px-5 py-3 font-medium text-slate-500">Date</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Check In</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Check Out</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Hours Worked</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-brand grid place-items-center text-[10px] font-semibold text-white">{initials(r.employees?.name)}</div>
                      <div>
                        <p className="font-medium text-slate-900 text-xs">{r.employees?.name ?? "—"}</p>
                        <p className="text-[10px] text-slate-500">{r.employees?.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{r.punch_in_time || "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs">{r.punch_out_time || "—"}</td>
                  <td className="px-5 py-3 text-slate-700">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                  <td className="px-5 py-3"><Badge status={r.status} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500"><CalendarCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />No attendance records for this date</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Corrections */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Pending Attendance Corrections</h2>
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-amber-50/60">
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Old In</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Old Out</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Requested In</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Requested Out</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Remarks</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium text-slate-900">{p.employees?.name} <span className="text-xs text-slate-500">({p.employees?.employee_id})</span></td>
                      <td className="px-5 py-3 text-slate-600">{fmtDate(p.date)}</td>
                      <td className="px-5 py-3 font-mono text-xs">{p.original_punch_in || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs">{p.original_punch_out || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-brand font-medium">{p.punch_in_time || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-brand font-medium">{p.punch_out_time || "—"}</td>
                      <td className="px-5 py-3 text-slate-600 text-xs max-w-[150px] truncate">{p.remarks || "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleReview(p.id, "approve")} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleReview(p.id, "reject")} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Employee View ─── */
function EmployeeAttendance({ profile }: { profile: any }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<AttRow[]>([]);
  const [editRow, setEditRow] = useState<AttRow | null>(null);
  const [editForm, setEditForm] = useState({ punch_in: "", punch_out: "", remarks: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const { data } = await supabase.from("attendance").select("*")
      .eq("user_auth_uid", profile.auth_uid)
      .gte("date", start).lte("date", end)
      .order("date", { ascending: false });
    setRows((data as AttRow[]) ?? []);
  };

  useEffect(() => { load(); }, [month, year, profile]);

  const openEdit = (row: AttRow) => {
    const daysAgo = Math.floor((Date.now() - new Date(row.date).getTime()) / 86400000);
    if (daysAgo > 7) {
      toast.error("Cannot edit attendance older than 7 days");
      return;
    }
    setEditRow(row);
    setEditForm({ punch_in: row.punch_in_time, punch_out: row.punch_out_time, remarks: "" });
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const hours = calcHours(editForm.punch_in, editForm.punch_out);
      await supabase.from("attendance").update({
        original_punch_in: editRow.punch_in_time,
        original_punch_out: editRow.punch_out_time,
        punch_in_time: editForm.punch_in,
        punch_out_time: editForm.punch_out,
        total_hours: hours,
        remarks: editForm.remarks,
        edit_requested: true,
        approval_status: "Pending",
      }).eq("id", editRow.id);
      toast.success("Attendance edit request submitted");
      setEditRow(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Review your monthly attendance history and work log.</p>
      </div>

      <div className="flex gap-3">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                <th className="text-left px-5 py-3 font-medium text-slate-500">Date</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Check In</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Check Out</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Hours Worked</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const daysAgo = Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-slate-600">{fmtDate(r.date)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{r.punch_in_time || "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs">{r.punch_out_time || "—"}</td>
                    <td className="px-5 py-3 text-slate-700">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Badge status={r.status} />
                        {r.edit_requested && <Badge status={r.approval_status} />}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openEdit(r)}
                        disabled={daysAgo > 7 || r.edit_requested}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500"><CalendarCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />No attendance records for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={!!editRow} title="Request Attendance Edit" onClose={() => setEditRow(null)}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Date</label>
            <input type="text" value={fmtDate(editRow?.date)} disabled className="input-field opacity-60" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Punch In</label>
              <input type="time" value={editForm.punch_in} onChange={(e) => setEditForm({ ...editForm, punch_in: e.target.value })} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Punch Out</label>
              <input type="time" value={editForm.punch_out} onChange={(e) => setEditForm({ ...editForm, punch_out: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Remarks</label>
            <textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} placeholder="Explain the reason for correction…" rows={3} className="input-field resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditRow(null)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={submitEdit} disabled={saving} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
