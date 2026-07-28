import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users, UserCheck, UserX, Clock, IndianRupee, ArrowRight,
  PlaneTakeoff, Wallet, CalendarDays, CalendarCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";
import { StatCard } from "@/components/hrms/StatCard";
import { Modal } from "@/components/hrms/Modal";
import { fmtDate, fmtMoney, todayISO } from "@/lib/hrms-utils";

type DashboardListItem = {
  auth_uid: string;
  name: string;
  employee_id: string;
  email?: string | null;
  detail?: string;
};

type DashboardListView = {
  title: string;
  badge: string;
  items: DashboardListItem[];
} | null;

export function DashboardPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role === "Admin") return <AdminDashboard />;
  if (profile.role === "CEO") return <CeoDashboard />;
  return <EmployeeDashboard />;
}

function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, pending: 0, payroll: 0 });
  const [dashboardList, setDashboardList] = useState<DashboardListView>(null);
  const [employeeAttendance, setEmployeeAttendance] = useState({ present: [] as DashboardListItem[], absent: [] as DashboardListItem[] });
  const [pendingLeaves, setPendingLeaves] = useState<DashboardListItem[]>([]);

  useEffect(() => {
    (async () => {
      const today = todayISO();
      const now = new Date();
      const { data: allEmps } = await supabase.from("employees").select("*");

      let authUsersMap = new Map<string, any>();
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
        if (authData?.users) {
          authData.users.forEach((u: any) => authUsersMap.set(u.id, u));
        }
      } catch (e) {
        console.warn("Could not fetch auth users for dashboard stats:", e);
      }

      const emps = (allEmps ?? []).filter((emp: any) => {
        const authUser = emp.auth_uid ? authUsersMap.get(emp.auth_uid) : null;
        const metadata = authUser?.user_metadata ?? {};
        const role = emp.role || metadata.role;
        if (role === "Admin" || role === "CEO") return false;

        const isMetaActive = metadata.status === "Active" || metadata.is_active === true || metadata.employment_status === "Active";
        const isDbActive = emp.status === "Active" || emp.is_active === true || emp.employment_status === "Active";

        const isMetaInactive = metadata.status === "Inactive" || metadata.is_active === false || metadata.employment_status === "Inactive";
        const isDbInactive = emp.status === "Inactive" || emp.is_active === false || emp.employment_status === "Inactive";

        let isInactive = false;
        if (isMetaActive || isDbActive) {
          isInactive = false;
        } else if (isMetaInactive || isDbInactive) {
          isInactive = true;
        }

        return !isInactive;
      });

      const { data: att } = await supabase.from("attendance").select("user_auth_uid, status").eq("date", today);
      const { data: lv } = await supabase.from("leaves")
        .select("user_auth_uid, leave_type, start_date, end_date, employees!leaves_user_auth_uid_fkey(name, employee_id, email)")
        .eq("status", "Pending");
      const { data: pay } = await supabase.from("payroll_with_employee_details").select("netSalary")
        .eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).eq("status", "Paid");

      const total = emps?.length ?? 0;
      const attendanceMap = new Map((att ?? []).filter((row: any) => row.user_auth_uid).map((row: any) => [row.user_auth_uid, row.status]));

      const presentEmployees = (emps ?? [])
        .filter((emp: any) => emp.auth_uid && attendanceMap.get(emp.auth_uid) === "Present")
        .map((emp: any) => ({
          auth_uid: emp.auth_uid,
          name: emp.name ?? "Unnamed Employee",
          employee_id: emp.employee_id ?? "—",
          email: emp.email,
        }));

      const absentEmployees = (emps ?? [])
        .filter((emp: any) => {
          if (!emp.auth_uid) return false;
          const status = attendanceMap.get(emp.auth_uid);
          return status !== "Present" && status !== "Leave";
        })
        .map((emp: any) => ({
          auth_uid: emp.auth_uid,
          name: emp.name ?? "Unnamed Employee",
          employee_id: emp.employee_id ?? "—",
          email: emp.email,
        }));

      const present = presentEmployees.length;
      const onLeave = (att ?? []).filter((a: any) => a.status === "Leave").length;
      const pendingLeaveItems = (lv ?? []).map((leave: any) => {
        const emp = leave.employees?.[0] ?? leave.employees;
        const dateRange = [leave.start_date, leave.end_date].filter(Boolean).join(" to ");
        return {
          auth_uid: leave.user_auth_uid,
          name: emp?.name ?? "Unnamed Employee",
          employee_id: emp?.employee_id ?? "—",
          email: emp?.email,
          detail: `${leave.leave_type ?? "Leave"}${dateRange ? ` • ${dateRange}` : ""}`,
        };
      });

      setStats({
        total, present, absent: Math.max(0, total - present - onLeave),
        pending: pendingLeaveItems.length,
        payroll: (pay ?? []).reduce((s, p) => s + Number(p.netSalary), 0),
      });
      setEmployeeAttendance({ present: presentEmployees, absent: absentEmployees });
      setPendingLeaves(pendingLeaveItems);
    })();
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Admin Console</h1>
        <p className="text-sm text-slate-500 mt-1">Company-wide operational overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard title="Total Employees" value={stats.total} icon={Users} color="blue" />
        <StatCard
          title="Present Today"
          value={stats.present}
          icon={UserCheck}
          color="emerald"
          onClick={() => setDashboardList({ title: "Present Employees", badge: "Present", items: employeeAttendance.present })}
        />
        <StatCard
          title="Absent Today"
          value={stats.absent}
          icon={UserX}
          color="rose"
          onClick={() => setDashboardList({ title: "Absent Employees", badge: "Absent", items: employeeAttendance.absent })}
        />
        <StatCard
          title="Pending Leaves"
          value={stats.pending}
          icon={Clock}
          color="amber"
          onClick={() => setDashboardList({ title: "Pending Leave Requests", badge: "Pending", items: pendingLeaves })}
        />
        <StatCard title="Monthly Payroll" value={fmtMoney(stats.payroll)} icon={IndianRupee} color="violet" />
      </div>

      <Modal
        open={!!dashboardList}
        title={dashboardList?.title ?? "Employees"}
        onClose={() => setDashboardList(null)}
        maxWidth="max-w-2xl"
      >
        {dashboardList && dashboardList.items.length > 0 ? (
          <div className="space-y-2">
            {dashboardList.items.map((item) => (
              <div key={item.auth_uid} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.employee_id}{item.email ? ` • ${item.email}` : ""}</p>
                  {item.detail ? <p className="mt-1 text-xs text-slate-500">{item.detail}</p> : null}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${dashboardList.badge === "Present" ? "bg-emerald-100 text-emerald-700" : dashboardList.badge === "Pending" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                  {dashboardList.badge}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No items found for this selection.</p>
        )}
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { to: "/employees", icon: Users, label: "Add Employee", desc: "Onboard new staff" },
              { to: "/leaves", icon: PlaneTakeoff, label: "Review Leaves", desc: "Approve or reject" },
              { to: "/payroll", icon: Wallet, label: "Process Salaries", desc: "Run monthly payroll" },
              { to: "/holidays", icon: CalendarDays, label: "Manage Holidays", desc: "Update calendar" },
            ].map((a) => (
              <Link key={a.to} to={a.to} className="flex items-center gap-4 p-4 rounded-xl border hover:border-brand hover:bg-brand-soft/30 transition">
                <div className="h-10 w-10 rounded-xl bg-brand-soft grid place-items-center text-brand">
                  <a.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{a.label}</p>
                  <p className="text-xs text-slate-500">{a.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Operational Summary</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500">Presence Rate</p>
              <p className="text-3xl font-bold text-slate-900">
                {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%
              </p>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${stats.total > 0 ? (stats.present / stats.total) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-slate-500">{stats.present} of {stats.total} employees present today</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ present: 0, absent: 0, leaves: 0, approved: 0, total: 0 });
  const [lastPay, setLastPay] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const now = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data: att } = await supabase.from("attendance").select("status")
        .eq("user_auth_uid", profile.auth_uid).gte("date", start).lte("date", end);
      const present = (att ?? []).filter((a) => a.status === "Present").length;
      const absent = (att ?? []).filter((a) => a.status === "Absent").length;
      const leaves = (att ?? []).filter((a) => a.status === "Leave").length;
      const { data: lv } = await supabase.from("leaves").select("status").eq("user_auth_uid", profile.auth_uid);
      const total = lv?.length ?? 0;
      const approved = (lv ?? []).filter((l) => l.status === "Approved").length;
      setStats({ present, absent, leaves, approved, total });

      const { data: pay } = await supabase.from("payroll").select("*").eq("user_auth_uid", profile.auth_uid)
        .order("year", { ascending: false }).order("month", { ascending: false }).limit(1).maybeSingle();
      setLastPay(pay);

      const today = todayISO();
      const { data: hol } = await supabase.from("holidays").select("*").gte("date", today).order("date").limit(5);
      setHolidays(hol ?? []);
    })();
  }, [profile]);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">Your personal HR overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Days Present" value={stats.present} icon={UserCheck} color="blue" subtext="This month" />
        <StatCard title="Days Absent" value={stats.absent} icon={UserX} color="rose" subtext="This month" />
        <StatCard title="Days on Leave" value={stats.leaves} icon={CalendarCheck} color="amber" subtext="This month" />
        <StatCard title="Leaves Status" value={`${stats.approved}/${stats.total}`} icon={PlaneTakeoff} color="violet" subtext="Approved / Total" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Last Paid Salary</h2>
            <Link to="/payroll" className="text-xs text-brand hover:underline">View History →</Link>
          </div>
          {lastPay ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Period</span><span className="font-medium">{lastPay.month}/{lastPay.year}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Basic Salary</span><span>{fmtMoney(lastPay.basicSalary)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Deductions</span><span className="text-rose-600">−{fmtMoney(lastPay.deductions)}</span></div>
              <div className="flex justify-between pt-2 border-t"><span className="font-semibold">Net Salary</span><span className="font-bold text-emerald-600">{fmtMoney(lastPay.netSalary)}</span></div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No payroll records yet</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Upcoming Holidays</h2>
          {holidays.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming holidays</p>
          ) : (
            <ul className="space-y-3">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-slate-500">{h.type}</p>
                  </div>
                  <span className="text-slate-600">{fmtDate(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CeoDashboard() {
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, budgetImpact: 0, avgIncrement: 0 });
  const [recentRevisions, setRecentRevisions] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: appraisals } = await supabase
        .from("appraisals")
        .select("*")
        .neq("status", "Draft");

      const rows = appraisals ?? [];
      const pending = rows.filter((r) => r.status === "Admin Reviewed").length;
      const approved = rows.filter((r) => r.status === "CEO Approved" || r.status === "Completed").length;
      const rejected = rows.filter((r) => r.status === "Rejected").length;

      const approvedRows = rows.filter((r) => r.status === "CEO Approved" || r.status === "Completed");
      const budgetImpact = approvedRows.reduce((sum, r) => sum + Number(r.ceo_increment_amount || 0), 0);
      const avgIncrement = approvedRows.length > 0
        ? Math.round((approvedRows.reduce((sum, r) => sum + Number(r.ceo_increment_percentage || 0), 0) / approvedRows.length) * 100) / 100
        : 0;

      setStats({ pending, approved, rejected, budgetImpact, avgIncrement });
      setRecentRevisions(rows.slice(0, 5));
    })();
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">CEO Executive Suite</h1>
        <p className="text-sm text-slate-500 mt-1">Strategic performance and compensation overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard title="Pending Approvals" value={stats.pending} icon={Clock} color="amber" />
        <StatCard title="Approved Appraisals" value={stats.approved} icon={UserCheck} color="emerald" />
        <StatCard title="Rejected Appraisals" value={stats.rejected} icon={UserX} color="rose" />
        <StatCard title="Budget Impact" value={fmtMoney(stats.budgetImpact)} icon={IndianRupee} color="violet" subtext="Monthly increment total" />
        <StatCard title="Avg Increment" value={`${stats.avgIncrement}%`} icon={IndianRupee} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Appraisal Revisions</h2>
            <Link to="/appraisals" className="text-xs text-brand hover:underline">View All →</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-500">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Cycle</th>
                  <th className="px-4 py-3">Current Salary</th>
                  <th className="px-4 py-3">Increment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentRevisions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No appraisal revisions found
                    </td>
                  </tr>
                ) : (
                  recentRevisions.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {r.employee_name}
                        <span className="block text-xs text-slate-400 font-normal">{r.employee_id}</span>
                      </td>
                      <td className="px-4 py-3">{r.appraisal_cycle}</td>
                      <td className="px-4 py-3">{fmtMoney(r.current_salary)}</td>
                      <td className="px-4 py-3 text-emerald-600">
                        +{r.status === "CEO Approved" || r.status === "Completed" ? r.ceo_increment_percentage : r.admin_increment_percentage}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status === "Completed" || r.status === "CEO Approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : r.status === "Admin Reviewed"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-50 text-slate-700 border border-slate-200"
                          }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-4 text-slate-900">Compensation Actions</h2>
            <p className="text-sm text-slate-500 mb-6">
              Review and finalize salary structures based on pending manager appraisal submissions.
            </p>
          </div>
          <Link
            to="/appraisals"
            className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-brand text-white font-medium hover:bg-brand-dark transition"
          >
            Go to Appraisals Console
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
