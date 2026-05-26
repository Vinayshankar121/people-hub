import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users, UserCheck, UserX, Clock, DollarSign, ArrowRight,
  PlaneTakeoff, Wallet, CalendarDays, CalendarCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/hrms/StatCard";
import { fmtDate, fmtMoney, todayISO } from "@/lib/hrms-utils";

export function DashboardPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === "Admin" ? <AdminDashboard /> : <EmployeeDashboard />;
}

function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, pending: 0, payroll: 0 });

  useEffect(() => {
    (async () => {
      const today = todayISO();
      const now = new Date();
      const { data: emps } = await supabase.from("employees").select("role").eq("role", "Employee");
      const { data: att } = await supabase.from("attendance").select("status").eq("date", today);
      const { data: lv } = await supabase.from("leaves").select("id").eq("status", "Pending");
      const { data: pay } = await supabase.from("payroll_with_employee_details").select("netSalary")
        .eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).eq("status", "Paid");
      const total = emps?.length ?? 0;
      const present = (att ?? []).filter((a) => a.status === "Present").length;
      const onLeave = (att ?? []).filter((a) => a.status === "Leave").length;
      setStats({
        total, present, absent: Math.max(0, total - present - onLeave),
        pending: lv?.length ?? 0,
        payroll: (pay ?? []).reduce((s, p) => s + Number(p.netSalary), 0),
      });
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
        <StatCard title="Present Today" value={stats.present} icon={UserCheck} color="emerald" />
        <StatCard title="Absent Today" value={stats.absent} icon={UserX} color="rose" />
        <StatCard title="Pending Leaves" value={stats.pending} icon={Clock} color="amber" />
        <StatCard title="Monthly Payroll" value={fmtMoney(stats.payroll)} icon={DollarSign} color="violet" />
      </div>

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
