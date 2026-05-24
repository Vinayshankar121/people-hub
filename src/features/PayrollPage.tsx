import { useEffect, useState } from "react";
import { Wallet, FileDown, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { fmtMoney, initials } from "@/lib/hrms-utils";
import { previewPayroll, generatePayroll } from "@/lib/admin.functions";
import { toast } from "sonner";

// @ts-ignore
import { jsPDF } from "jspdf";

type PayrollRow = {
  id: string;
  user_auth_uid: string;
  month: number;
  year: number;
  basicSalary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  approvedLeaves: number;
  holidays: number;
  deductions: number;
  netSalary: number;
  status: string;
  employees?: { name: string; employee_id: string };
};

type PreviewRow = {
  auth_uid: string;
  name: string;
  employee_id: string;
  basicSalary: number;
  workingDays: number;
  presentDays: number;
  approvedLeaves: number;
  holidays: number;
  absentDays: number;
  deductions: number;
  netSalary: number;
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function PayrollPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === "Admin" ? <AdminPayroll /> : <EmployeePayroll profile={profile} />;
}

/* ─── Admin View ─── */
function AdminPayroll() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [history, setHistory] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadHistory = async () => {
    const { data } = await supabase.from("payroll")
      .select("*, employees!payroll_user_auth_uid_fkey(name, employee_id)")
      .order("year", { ascending: false }).order("month", { ascending: false });
    setHistory((data as PayrollRow[]) ?? []);
  };

  useEffect(() => { loadHistory(); }, []);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const result = await previewPayroll({ data: { month, year } });
      setPreview(result.preview);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generatePayroll({ data: { month, year } });
      toast.success(`Payroll generated for ${result.count} employees`);
      setShowConfirm(false);
      setPreview(null);
      loadHistory();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Payroll Processing</h1>
        <p className="text-sm text-slate-500 mt-1">Generate monthly employee payroll and issue payslip PDFs.</p>
      </div>

      {/* Process New Month */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Process New Month</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPreview(null); }} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPreview(null); }} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handlePreview} disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            <Eye className="h-4 w-4" /> {loading ? "Calculating…" : "Preview Calculations"}
          </button>
        </div>

        {preview && (
          <div className="mt-6">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/60">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Employee</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Basic Salary</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Work Days</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Present</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Leaves</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Holidays</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Absent</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Deductions</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Est. Net</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.auth_uid} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{p.name} <span className="text-xs text-slate-400">({p.employee_id})</span></td>
                      <td className="px-4 py-2.5">{fmtMoney(p.basicSalary)}</td>
                      <td className="px-4 py-2.5">{p.workingDays}</td>
                      <td className="px-4 py-2.5 text-emerald-600 font-medium">{p.presentDays}</td>
                      <td className="px-4 py-2.5 text-amber-600">{p.approvedLeaves}</td>
                      <td className="px-4 py-2.5">{p.holidays}</td>
                      <td className="px-4 py-2.5 text-rose-600 font-medium">{p.absentDays}</td>
                      <td className="px-4 py-2.5 text-rose-600">−{fmtMoney(p.deductions)}</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-600">{fmtMoney(p.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowConfirm(true)} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:opacity-90 transition">
                Lock & Distribute Payslips
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payroll History */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Payroll History</h2>
        <PayrollTable rows={history} showEmployee />
      </div>

      {/* Confirm Dialog */}
      <Modal open={showConfirm} title="Confirm Payroll Generation" onClose={() => setShowConfirm(false)}>
        <p className="text-sm text-slate-600">
          This will lock payroll for <strong>{MONTHS[month - 1]} {year}</strong> and mark all records as Paid.
          This action cannot be undone easily.
        </p>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowConfirm(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleGenerate} disabled={generating} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {generating ? "Processing…" : "Confirm & Generate"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Employee View ─── */
function EmployeePayroll({ profile }: { profile: any }) {
  const [history, setHistory] = useState<PayrollRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payroll").select("*")
        .eq("user_auth_uid", profile.auth_uid)
        .order("year", { ascending: false }).order("month", { ascending: false });
      setHistory((data as PayrollRow[]) ?? []);
    })();
  }, [profile]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Payroll Processing</h1>
        <p className="text-sm text-slate-500 mt-1">Download and review your monthly payslips.</p>
      </div>
      <PayrollTable rows={history} showEmployee={false} employeeName={profile.name} employeeId={profile.employee_id} />
    </div>
  );
}

/* ─── Shared Table ─── */
function PayrollTable({ rows, showEmployee, employeeName, employeeId }: { rows: PayrollRow[]; showEmployee: boolean; employeeName?: string; employeeId?: string }) {
  const downloadPdf = (row: PayrollRow) => {
    const doc = new jsPDF();
    const name = (row as any).employees?.name ?? employeeName ?? "Employee";
    const eid = (row as any).employees?.employee_id ?? employeeId ?? "";

    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text("Tech Minds IT Solutions", 20, 25);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("PAYSLIP", 20, 33);

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 38, 190, 38);

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    const y0 = 48;
    const data = [
      ["Employee", `${name} (${eid})`],
      ["Period", `${MONTHS[row.month - 1]} ${row.year}`],
      ["Basic Salary", fmtMoney(row.basicSalary)],
      ["Working Days", String(row.workingDays)],
      ["Present Days", String(row.presentDays)],
      ["Approved Leaves", String(row.approvedLeaves)],
      ["Holidays", String(row.holidays)],
      ["Absent Days", String(row.absentDays)],
      ["Deductions", `−${fmtMoney(row.deductions)}`],
    ];
    data.forEach(([k, v], i) => {
      doc.setTextColor(100, 116, 139);
      doc.text(k, 20, y0 + i * 9);
      doc.setTextColor(30, 41, 59);
      doc.text(v, 100, y0 + i * 9);
    });

    const netY = y0 + data.length * 9 + 5;
    doc.line(20, netY - 3, 190, netY - 3);
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129);
    doc.text(`Net Salary: ${fmtMoney(row.netSalary)}`, 20, netY + 5);

    doc.save(`Payslip_${eid}_${row.month}_${row.year}.pdf`);
  };

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50/60">
              <th className="text-left px-5 py-3 font-medium text-slate-500">Period</th>
              {showEmployee && <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>}
              <th className="text-left px-5 py-3 font-medium text-slate-500">Basic Salary</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Deductions</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Net Salary</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-900">{MONTHS[r.month - 1]} {r.year}</td>
                {showEmployee && (
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-brand grid place-items-center text-[10px] font-semibold text-white">{initials((r as any).employees?.name)}</div>
                      <div>
                        <p className="text-xs font-medium">{(r as any).employees?.name ?? "—"}</p>
                        <p className="text-[10px] text-slate-500">{(r as any).employees?.employee_id}</p>
                      </div>
                    </div>
                  </td>
                )}
                <td className="px-5 py-3">{fmtMoney(r.basicSalary)}</td>
                <td className="px-5 py-3 text-rose-600">−{fmtMoney(r.deductions)}</td>
                <td className="px-5 py-3 font-bold text-emerald-600">{fmtMoney(r.netSalary)}</td>
                <td className="px-5 py-3"><Badge status={r.status} /></td>
                <td className="px-5 py-3">
                  <button onClick={() => downloadPdf(r)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand bg-brand-soft hover:bg-brand-soft/80 transition">
                    <FileDown className="h-3.5 w-3.5" /> PDF
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={showEmployee ? 7 : 6} className="text-center py-12 text-slate-500"><Wallet className="h-10 w-10 mx-auto text-slate-300 mb-2" />No payroll records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
