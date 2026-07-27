import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  CalendarCheck,
  Pencil,
  Search,
  Check,
  X,
  UserCheck,
  UserX,
  Clock,
  CalendarDays,
  Sparkles,
  AlertCircle,
  MapPin
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { fmtDate, todayISO, calcHours, initials } from "@/lib/hrms-utils";
import { makeMonthRangeUTC, reviewAttendanceEdit } from "@/lib/admin.functions";
import { toast } from "sonner";

function isoToLocalDayOfWeek(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.getDay();
}

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
  original_punch_in?: string;
  original_punch_out?: string;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  distance_meters?: number;
  employees?: { name: string; employee_id: string };
};

type AdminAttendanceStatus = "Present" | "Half Day" | "Absent" | "Leave" | "Weekend";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function AttendancePage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === "Admin" || profile.role === "CEO" ? <AdminAttendance /> : <EmployeeAttendance profile={profile} />;
}

/* ─── Admin View ─── */
function AdminAttendance() {
  const location = useLocation();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">("daily");

  // Existing daily log view state
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<AttRow[]>([]);
  const [pending, setPending] = useState<AttRow[]>([]);
  const [employees, setEmployees] = useState<{ auth_uid: string; name: string; employee_id: string; email?: string }[]>([]);
  const [empFilter, setEmpFilter] = useState("All");
  const [editRow, setEditRow] = useState<AttRow | null>(null);
  const [editForm, setEditForm] = useState({ punch_in: "", punch_out: "", status: "" });
  const [saving, setSaving] = useState(false);

  // Manual upsert section state
  const [empQuery, setEmpQuery] = useState("");
  const [selectedAuthUid, setSelectedAuthUid] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [manualStatus, setManualStatus] = useState<AdminAttendanceStatus>("Present");
  const [manualPunchIn, setManualPunchIn] = useState<string>("");
  const [manualPunchOut, setManualPunchOut] = useState<string>("");
  const [manualRemarks, setManualRemarks] = useState<string>("");
  const [manualSaving, setManualSaving] = useState<boolean>(false);

  // Monthly Report tab state
  const [monthlyEmpUid, setMonthlyEmpUid] = useState("");
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth());
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyLogs, setMonthlyLogs] = useState<AttRow[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState({
    workingDays: 0,
    presentDays: 0,
    absentDays: 0,
    leaves: 0,
    holidays: 0,
    halfDays: 0,
    lateArrivals: 0,
    overtimeHours: 0,
  });

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

  useEffect(() => {
    loadAll();
  }, [date, empFilter]);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    try {
      await reviewAttendanceEdit({ data: { id, action } });
      toast.success(action === "approve" ? "Correction approved" : "Correction rejected");
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEdit = (row: AttRow) => {
    setEditRow(row);
    setEditForm({
      punch_in: row.punch_in_time ?? "",
      punch_out: row.punch_out_time ?? "",
      status: row.status || "Present",
    });
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const punchIn = editForm.punch_in || "";
      const punchOut = editForm.punch_out || "";
      const hours = editForm.status === "Absent" ? 0 : calcHours(editForm.punch_in ?? "", editForm.punch_out ?? "");

      await supabase
        .from("attendance")
        .upsert(
          {
            user_auth_uid: editRow.user_auth_uid,
            date: editRow.date,
            punch_in_time: punchIn,
            punch_out_time: punchOut,
            total_hours: hours,
            status: editForm.status,
            approval_status: "Approved",
            edit_requested: false,
            remarks: editRow.remarks || "",
          },
          { onConflict: "user_auth_uid,date" }
        );
      toast.success("Attendance updated successfully");
      setEditRow(null);
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runMonthlySearch = async (uid: string, monthValue: number, yearValue: number) => {
    if (!uid) {
      toast.error("Please select an employee");
      return;
    }

    setMonthlyLoading(true);
    try {
      const { start, end, startISO, endISO } = makeMonthRangeUTC(monthValue + 1, yearValue);

      const { data: attData, error: attError } = await supabase
        .from("attendance")
        .select("*, employees!attendance_user_auth_uid_fkey(name, employee_id)")
        .eq("user_auth_uid", uid)
        .gte("date", startISO)
        .lte("date", endISO)
        .order("date", { ascending: true });

      if (attError) throw attError;

      const { data: holData, error: holError } = await supabase
        .from("holidays")
        .select("date, category")
        .gte("date", startISO)
        .lte("date", endISO);

      if (holError) throw holError;

      const nonOptionalHolidays = (holData ?? []).filter(
        (h: any) => h.category !== "Optional" && h.category !== "Weekend"
      );
      const holidaySet = new Set(nonOptionalHolidays.map((h: any) => h.date));

      // Build a map of actual attendance rows returned from DB
      const dbRows: AttRow[] = (attData as AttRow[]) ?? [];
      const attByDate = new Map<string, AttRow>();
      dbRows.forEach((r) => attByDate.set(r.date, r));

      const emp = employees.find((e) => e.auth_uid === uid) || undefined;

      let workingDays = 0;
      let holidaysCount = 0;

      const combinedRows: AttRow[] = [];

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        const day = d.getUTCDay();
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
        const dayName = dayNames[day];
        const isWorking = settings?.attendance?.workingDays?.[dayName] ?? (day !== 0);
        const isWeekend = !isWorking;
        const isHoliday = holidaySet.has(iso);

        if (isHoliday) {
          holidaysCount++;
          // show holidays in the log as well
          combinedRows.push({
            id: `holiday-${iso}`,
            user_auth_uid: uid,
            date: iso,
            punch_in_time: "",
            punch_out_time: "",
            total_hours: 0,
            status: "Holiday",
            approval_status: "",
            edit_requested: false,
            original_punch_in: "",
            original_punch_out: "",
            remarks: "",
            employees: emp ? { name: emp.name, employee_id: emp.employee_id } : undefined,
          });
        } else if (!isWeekend) {
          workingDays++;
          const found = attByDate.get(iso);
          if (found) {
            combinedRows.push(found);
          } else {
            // mark absent when no attendance record exists for a working day
            combinedRows.push({
              id: `absent-${iso}`,
              user_auth_uid: uid,
              date: iso,
              punch_in_time: "",
              punch_out_time: "",
              total_hours: 0,
              status: "Absent",
              approval_status: "",
              edit_requested: false,
              original_punch_in: "",
              original_punch_out: "",
              remarks: "",
              employees: emp ? { name: emp.name, employee_id: emp.employee_id } : undefined,
            });
          }
        } else {
          // weekend - show as Weekend status if no record exists
          const found = attByDate.get(iso);
          if (found) {
            combinedRows.push(found);
          } else {
            combinedRows.push({
              id: `weekend-${iso}`,
              user_auth_uid: uid,
              date: iso,
              punch_in_time: "",
              punch_out_time: "",
              total_hours: 0,
              status: "Weekend",
              approval_status: "",
              edit_requested: false,
              original_punch_in: "",
              original_punch_out: "",
              remarks: "",
              employees: emp ? { name: emp.name, employee_id: emp.employee_id } : undefined,
            });
          }
        }
      }

      // derive stats from the combined rows (which include synthetic absents)
      const presentCount = combinedRows.filter((r) => r.status === "Present").length;
      const halfDaysCount = combinedRows.filter((r) => r.status === "Half Day").length;
      const leaveDaysCount = combinedRows.filter((r) => r.status === "Leave").length;
      const absentCount = combinedRows.filter((r) => r.status === "Absent").length;

      const lateArrivalsCount = combinedRows.filter((r) => {
        if (r.status !== "Present" && r.status !== "Half Day") return false;
        if (!r.punch_in_time) return false;
        return r.punch_in_time.localeCompare("09:15") > 0;
      }).length;

      const overtimeHoursCount = combinedRows.reduce((sum, r) => {
        return sum + Math.max(0, Number(r.total_hours || 0) - 8);
      }, 0);

      setMonthlyLogs(combinedRows);
      setMonthlyStats({
        workingDays,
        presentDays: presentCount,
        absentDays: absentCount,
        leaves: leaveDaysCount,
        holidays: holidaysCount,
        halfDays: halfDaysCount,
        lateArrivals: lateArrivalsCount,
        overtimeHours: Math.round(overtimeHoursCount * 100) / 100,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Error fetching monthly statistics");
    } finally {
      setMonthlyLoading(false);
    }
  };

  const handleMonthlySearch = async () => {
    await runMonthlySearch(monthlyEmpUid, monthlyMonth, monthlyYear);
  };

  useEffect(() => {
    let employeeParam: string | null = null;
    let monthParam: string | null = null;
    let yearParam: string | null = null;

    if (location.search && typeof location.search === "object") {
      const searchObj: any = location.search;
      employeeParam = searchObj.employee ? String(searchObj.employee) : null;
      monthParam = searchObj.month ? String(searchObj.month) : null;
      yearParam = searchObj.year ? String(searchObj.year) : null;
    } else if (typeof location.search === "string" && location.search) {
      const params = new URLSearchParams(location.search);
      employeeParam = params.get("employee");
      monthParam = params.get("month");
      yearParam = params.get("year");
    }

    if (!employeeParam) {
      const params = new URLSearchParams(window.location.search);
      employeeParam = params.get("employee");
      monthParam = params.get("month");
      yearParam = params.get("year");
    }

    if (!employeeParam) return;

    setActiveTab("monthly");
    setMonthlyEmpUid(employeeParam);

    const parsedMonth = monthParam ? Number(monthParam) - 1 : new Date().getMonth();
    const parsedYear = yearParam ? Number(yearParam) : new Date().getFullYear();

    setMonthlyMonth(parsedMonth);
    setMonthlyYear(parsedYear);

    void runMonthlySearch(employeeParam, parsedMonth, parsedYear);
  }, [location.search]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Attendance Console</h1>
        <p className="text-sm text-slate-500 mt-1">Configure company logs, run reports, and review correction updates.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("daily")}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${activeTab === "daily"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
          >
            Daily Logs & Corrections
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${activeTab === "monthly"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
          >
            Employee Monthly View
          </button>
        </nav>
      </div>

      {activeTab === "daily" ? (
        <>
          {/* Daily Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
              <option value="All">All Employees</option>
              {employees.map((em) => <option key={em.auth_uid} value={em.auth_uid}>{em.name} ({em.employee_id})</option>)}
            </select>
          </div>

          {/* Manual Admin Attendance (Upsert) */}
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Manual Attendance Management</h2>
                <p className="text-sm text-slate-500 mt-1">Search employee by ID / Email / Name and upsert attendance for any past date.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Search Employee</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    value={empQuery}
                    onChange={(e) => {
                      setEmpQuery(e.target.value);
                      setSelectedAuthUid("");
                    }}
                    placeholder="Employee ID, Email, or Name"
                    className="pl-9 pr-3 py-2.5 rounded-xl border bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const q = empQuery.trim();
                    if (!q) {
                      setSelectedAuthUid("");
                      return;
                    }

                    try {
                      const { data: found, error } = await supabase
                        .from("employees")
                        .select("auth_uid, employee_id, name, email")
                        .or(`employee_id.ilike.%${q}%,email.ilike.%${q}%,name.ilike.%${q}%`)
                        .limit(1)
                        .maybeSingle();

                      if (error) throw error;
                      if (!found) {
                        toast.error("No employee found for the given search");
                        setSelectedAuthUid("");
                        return;
                      }

                      setSelectedAuthUid(found.auth_uid);
                      toast.success(`Selected: ${found.name} (${found.employee_id})`);
                    } catch (err: any) {
                      toast.error(err?.message ?? "Failed to search employee");
                    }
                  }}
                  className="mt-2 w-full px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium transition border"
                >
                  Select Employee
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Attendance Date</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Status</label>
                <select value={manualStatus} onChange={(e) => setManualStatus(e.target.value as AdminAttendanceStatus)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Leave">Leave</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Modification Reason (Audit)</label>
                <input value={manualRemarks} onChange={(e) => setManualRemarks(e.target.value)} placeholder="e.g., Historical correction" className="px-3 py-2.5 rounded-xl border bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Punch In Time</label>
                <input type="time" value={manualPunchIn} onChange={(e) => setManualPunchIn(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Punch Out Time</label>
                <input type="time" value={manualPunchOut} onChange={(e) => setManualPunchOut(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setSelectedAuthUid("");
                  setEmpQuery("");
                  setSelectedDate(todayISO());
                  setManualStatus("Present");
                  setManualPunchIn("");
                  setManualPunchOut("");
                  setManualRemarks("");
                }}
                className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition border"
              >
                Reset
              </button>

              <button
                type="button"
                disabled={manualSaving}
                onClick={async () => {
                  if (!selectedAuthUid) {
                    toast.error("Please select an employee");
                    return;
                  }
                  if (!selectedDate) {
                    toast.error("Please select a date");
                    return;
                  }
                  if (manualStatus === "Present" && !manualPunchIn) {
                    toast.error("Punch In time is required when status is Present");
                    return;
                  }

                  const hours = manualStatus === "Absent" || manualStatus === "Leave" ? 0 : calcHours(manualPunchIn ?? "", manualPunchOut ?? "");

                  try {
                    setManualSaving(true);

                    await supabase
                      .from("attendance")
                      .upsert(
                        {
                          user_auth_uid: selectedAuthUid,
                          date: selectedDate,
                          punch_in_time: manualPunchIn || "",
                          punch_out_time: manualPunchOut || "",
                          total_hours: hours,
                          status: manualStatus,
                          approval_status: "Approved",
                          edit_requested: false,
                          remarks: manualRemarks || "",
                        },
                        { onConflict: "user_auth_uid,date" }
                      );

                    toast.success("Attendance saved successfully");
                    await loadAll();
                  } catch (err: any) {
                    toast.error(err?.message ?? "Failed to save attendance");
                  } finally {
                    setManualSaving(false);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
              >
                {manualSaving ? "Saving…" : "Save Attendance"}
              </button>
            </div>
          </div>

          {/* Daily Table */}
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
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Edit</th>
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
                      <td className="px-5 py-3 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{r.punch_in_time || "—"}</span>
                          {r.distance_meters !== undefined && r.distance_meters !== null ? (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-sans"
                              title={`GPS: Lat ${r.latitude}, Lon ${r.longitude} (Accuracy: ${r.accuracy}m)`}
                            >
                              <MapPin className="h-3 w-3 shrink-0 text-emerald-500" />
                              {r.distance_meters}m
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">{r.punch_out_time || "—"}</td>
                      <td className="px-5 py-3 text-slate-700">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                      <td className="px-5 py-3"><Badge status={r.status} /></td>
                      <td className="px-5 py-3">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-brand transition">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500"><CalendarCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />No attendance records for this date</td></tr>
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
        </>
      ) : (
        /* Employee Monthly View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border rounded-2xl shadow-sm">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Select Employee</label>
              <select
                value={monthlyEmpUid}
                onChange={(e) => setMonthlyEmpUid(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">-- Choose Employee --</option>
                {employees.map((em) => (
                  <option key={em.auth_uid} value={em.auth_uid}>
                    {em.employee_id} - {em.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Month</label>
              <select
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-[120px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Year</label>
              <select
                value={monthlyYear}
                onChange={(e) => setMonthlyYear(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleMonthlySearch}
                disabled={monthlyLoading}
                className="w-full sm:w-auto px-6 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition disabled:opacity-50"
              >
                {monthlyLoading ? "Searching…" : "Search / View"}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {monthlyLogs.length > 0 || Object.values(monthlyStats).some(val => val > 0) ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center"><CalendarDays className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Working Days</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.workingDays}</p>
                </div>
              </div>
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><UserCheck className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Present Days</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.presentDays}</p>
                </div>
              </div>
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center"><UserX className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Absent Days</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.absentDays}</p>
                </div>
              </div>
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center"><Clock className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Leaves</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.leaves}</p>
                </div>
              </div>
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 grid place-items-center"><Sparkles className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Holidays</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.holidays}</p>
                </div>
              </div>
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><AlertCircle className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Half Days</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.halfDays}</p>
                </div>
              </div>
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 grid place-items-center"><Clock className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Late Arrivals</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.lateArrivals}</p>
                </div>
              </div>
              <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 grid place-items-center"><CalendarCheck className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-slate-500">Overtime Hours</p>
                  <p className="text-xl font-bold text-slate-900">{monthlyStats.overtimeHours}h</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Monthly Attendance Table */}
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/60">
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Employee ID</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Employee Name</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Punch In</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Punch Out</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Total Hours</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Approval Status</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyLogs.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-600">{fmtDate(r.date)}</td>
                      <td className="px-5 py-3 text-slate-900 font-semibold">{r.employees?.employee_id || "—"}</td>
                      <td className="px-5 py-3 text-slate-700">{r.employees?.name || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs">{r.punch_in_time || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs">{r.punch_out_time || "—"}</td>
                      <td className="px-5 py-3 text-slate-700">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                      <td className="px-5 py-3"><Badge status={r.status} /></td>
                      <td className="px-5 py-3"><Badge status={r.approval_status} /></td>
                      <td className="px-5 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={r.remarks}>{r.remarks || "—"}</td>
                    </tr>
                  ))}
                  {monthlyLogs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-500">
                        <CalendarCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                        Please select an employee and search to view monthly logs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit Modal */}
      <Modal open={!!editRow} title="Edit Attendance Record" onClose={() => setEditRow(null)}>
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
            <label className="text-xs font-medium text-slate-600">Status</label>
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input-field">
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
              <option value="Holiday">Holiday</option>
              <option value="Half Day">Half Day</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditRow(null)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={submitEdit} disabled={saving} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {saving ? "Updating…" : "Update Attendance"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Employee View ─── */
function EmployeeAttendance({ profile }: { profile: any }) {
  const { isWorkingDay } = useSettings();
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

  useEffect(() => {
    load();
  }, [month, year, profile]);

  const openEdit = (row: AttRow) => {
    const daysAgo = Math.floor((Date.now() - new Date(row.date).getTime()) / 86400000);
    if (daysAgo > 7) {
      toast.error("Cannot edit attendance older than 7 days");
      return;
    }
    setEditRow(row);
    setEditForm({
      punch_in: row.punch_in_time ?? "",
      punch_out: row.punch_out_time ?? "",
      remarks: "",
    });
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const dateISO = editRow.date;

      if (!isWorkingDay(dateISO)) {
        toast.error("Attendance cannot be saved on non-working days or holidays");
        return;
      }

      const { data: holidays } = await supabase
        .from("holidays")
        .select("date, type")
        .gte("date", dateISO)
        .lte("date", dateISO);

      const holiday = (holidays ?? []).find((h: any) => h.date === dateISO);
      if (holiday && holiday.type) {
        if (holiday.type !== "National" && holiday.type !== "Company") {
          toast.error("Attendance cannot be saved on this holiday");
          return;
        }
      }

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
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Attendance Logs</h1>
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
