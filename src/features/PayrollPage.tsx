import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Wallet, FileDown, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { fmtMoney, initials, formatHours } from "@/lib/hrms-utils";
import { previewPayroll, generatePayroll, getAttendanceSummaryForPeriod } from "@/lib/admin.functions";
import { generatePayslipPDF } from "@/lib/payslip";
import { toast } from "sonner";

type PayrollRow = {
  id: string;
  user_auth_uid: string;
  month: number;
  year: number;

  monthlySalary: number;
  yearlySalary: number;
  basicSalary: number;
  hra: number;
  otherAllowances: number;
  yearlyBasic: number;
  standardWorkingDays: number;
  standardWorkingHours: number;
  hourlyRate: number;
  totalWorkedHours: number;
  overtimeHours: number;
  grossSalary: number;
  yearlyHra: number;
  yearlyOtherAllowances: number;

  workingDays: number;
  presentDays: number;
  absentDays: number;
  approvedLeaves: number;
  holidays: number;
  deductions: number;
  netSalary: number;
  paid_leaves_used?: number;
  unpaid_leave_days?: number;
  appraisalApplied?: boolean;
  appraisalEffectiveFrom?: string;
  status: string;

  employee_id?: string;
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  phone?: string;
  joiningDate?: string;
  date_of_birth?: string;
  location?: string;
  bank_name?: string;
  bank_account_no?: string;
  pan_no?: string;
  pf_no?: string;
  universal_account_number?: string;
};

type PreviewRow = {
  auth_uid: string;
  name: string;
  employee_id: string;
  department?: string;
  monthlySalary?: number;
  basicSalary: number;
  workingDays: number;
  presentDays: number;
  approvedLeaves: number;
  holidays: number;
  absentDays: number;
  standardWorkingDays: number;
  standardWorkingHours: number;
  hourlyRate: number;
  totalWorkedHours: number;
  overtimeHours: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  appraisalApplied?: boolean;
  appraisalEffectiveFrom?: string;
};

type PayslipHistoryRow = {
  id: string;
  payroll_id: string;
  user_auth_uid: string;
  pdf_path: string;
  pdfUrl?: string | null;
  created_at: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PayrollPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  return profile.role === "Admin" || profile.role === "CEO"
    ? <AdminPayroll />
    : <EmployeePayroll profile={profile} />;
}

/* ─── Admin View ─── */
function AdminPayroll() {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [history, setHistory] = useState<PayrollRow[]>([]);
  const [payslipHistory, setPayslipHistory] = useState<PayslipHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("payroll_with_employee_details")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setHistory((data as PayrollRow[]) ?? []);
  };

  const loadPayslipHistory = async () => {
    const { data, error } = await supabase
      .from("payslips")
      .select("id, payroll_id, user_auth_uid, pdf_path, pdfUrl, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setPayslipHistory((data as PayslipHistoryRow[]) ?? []);
  };

  useEffect(() => {
    loadHistory();
    loadPayslipHistory();
  }, []);

  const handlePreview = async () => {
    setLoading(true);

    try {
      const result = await previewPayroll({ data: { month, year } });
      setPreview((result.preview ?? []) as PreviewRow[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to preview payroll");
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
      await loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate payroll");
    } finally {
      setGenerating(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Payroll Processing
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate monthly employee payroll and issue professional payslip PDFs.
        </p>
      </div>

      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Process New Month</h2>

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <select
            value={month}
            onChange={(e) => {
              setMonth(Number(e.target.value));
              setPreview(null);
            }}
            className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPreview(null);
            }}
            className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={handlePreview}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            <Eye className="h-4 w-4" />
            {loading ? "Calculating..." : "Preview Calculations"}
          </button>
        </div>

        {preview && (
          <div className="mt-6">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/60">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Employee</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Dept</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Monthly Salary</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Std Days</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Std Hours</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Hourly Rate</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Worked Hours</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Overtime</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Gross</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Deductions</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Net</th>
                  </tr>
                </thead>

                <tbody>
                  {preview.map((p) => (
                    <tr key={p.auth_uid} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">
                        <Link
                          to="/attendance"
                          search={{ employee: p.auth_uid, month: month.toString(), year: year.toString() }}
                          className="text-brand hover:underline"
                        >
                          {p.name}
                        </Link>
                        <span className="text-xs text-slate-400"> ({p.employee_id})</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p.department || "—"}</td>
                      <td className="px-4 py-2.5">{fmtMoney(p.monthlySalary || p.basicSalary)}</td>
                      <td className="px-4 py-2.5">{p.standardWorkingDays || 25}</td>
                      <td className="px-4 py-2.5">{p.standardWorkingHours || 9}</td>
                      <td className="px-4 py-2.5">{fmtMoney(p.hourlyRate)}</td>
                      <td className="px-4 py-2.5">{formatHours(p.totalWorkedHours)}</td>
                      <td className="px-4 py-2.5">{formatHours(p.overtimeHours)}</td>
                      <td className="px-4 py-2.5">{fmtMoney(p.grossSalary)}</td>
                      <td className="px-4 py-2.5 text-rose-600">-{fmtMoney(p.deductions)}</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-600">{fmtMoney(p.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowConfirm(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:opacity-90 transition"
              >
                Lock & Distribute Payslips
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Payroll History
        </h2>
        <PayrollTable rows={history} showEmployee onPayslipSaved={loadPayslipHistory} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Saved Payslip Downloads
        </h2>
        <div className="bg-white rounded-2xl border p-4 shadow-sm">
          {payslipHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No saved payslip downloads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/60">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Pay Period / Payroll</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Downloaded</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {payslipHistory.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.payroll_id || item.pdf_path || "Payslip"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {item.pdfUrl ? (
                          <a href={item.pdfUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                            View PDF
                          </a>
                        ) : (
                          <span className="text-slate-500">No URL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showConfirm}
        title="Confirm Payroll Generation"
        onClose={() => setShowConfirm(false)}
      >
        <p className="text-sm text-slate-600">
          This will lock payroll for{" "}
          <strong>
            {MONTHS[month - 1]} {year}
          </strong>{" "}
          and mark all records as Paid.
        </p>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setShowConfirm(false)}
            className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {generating ? "Processing..." : "Confirm & Generate"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Employee View ─── */
function EmployeePayroll({ profile }: { profile: any }) {
  const [history, setHistory] = useState<PayrollRow[]>([]);
  const [payslipHistory, setPayslipHistory] = useState<PayslipHistoryRow[]>([]);

  useEffect(() => {
    const loadEmployeePayroll = async () => {
      const { data, error } = await supabase
        .from("payroll_with_employee_details")
        .select("*")
        .filter("user_auth_uid", "eq", profile.auth_uid)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) {
        toast.error(error.message);
        return;
      }

      setHistory((data as PayrollRow[]) ?? []);
    };

    const loadEmployeePayslipHistory = async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("id, payroll_id, user_auth_uid, pdf_path, pdfUrl, created_at")
        .eq("user_auth_uid", profile.auth_uid)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error(error.message);
        return;
      }

      setPayslipHistory((data as PayslipHistoryRow[]) ?? []);
    };

    loadEmployeePayroll();
    loadEmployeePayslipHistory();
  }, [profile.auth_uid]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Payroll Processing
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Download and review your monthly payslips.
        </p>
      </div>

      <PayrollTable
        rows={history}
        showEmployee={false}
        employeeName={profile.name}
        employeeId={profile.employee_id}
        onPayslipSaved={async () => {
          const { data, error } = await supabase
            .from("payslips")
            .select("id, payroll_id, user_auth_uid, pdf_path, pdfUrl, created_at")
            .eq("user_auth_uid", profile.auth_uid)
            .order("created_at", { ascending: false });

          if (!error) {
            setPayslipHistory((data as PayslipHistoryRow[]) ?? []);
          }
        }}
      />

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Saved Payslip Downloads
        </h2>
        <div className="bg-white rounded-2xl border p-4 shadow-sm">
          {payslipHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No saved payslip downloads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/60">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Period</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Downloaded</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {payslipHistory.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.payroll_id || item.pdf_path || "Payslip"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {item.pdfUrl ? (
                          <a href={item.pdfUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                            View PDF
                          </a>
                        ) : (
                          <span className="text-slate-500">No URL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Table ─── */
function PayrollTable({
  rows,
  showEmployee,
  employeeName,
  employeeId,
  onPayslipSaved,
}: {
  rows: PayrollRow[];
  showEmployee: boolean;
  employeeName?: string;
  employeeId?: string;
  onPayslipSaved?: () => Promise<void>;
}) {
  const downloadPdf = async (row: PayrollRow | any) => {
    const name = row.name ?? employeeName ?? "Employee";
    const eid = row.employee_id ?? employeeId ?? "";
    const payrollId = row.id ?? null;
    const authUid = row.user_auth_uid ?? row.auth_uid;
    if (!authUid) {
      toast.error("Missing employee UID for payslip storage");
      return;
    }

    try {
      const filename = `${eid || authUid || 'emp'}-payslip-${row.year}-${row.month}.pdf`;

      // Fetch dynamic attendance summary to ensure it matches calculations
      let attSummary = {
        workingDays: Number(row.workingDays || 0),
        presentDays: Number(row.presentDays || 0),
        halfDays: 0,
        approvedLeaves: Number(row.approvedLeaves || 0),
        paidLeaves: Number(row.paid_leaves_used || 0),
        unpaidLeaves: Number(row.unpaid_leave_days || 0),
        absentDays: Number(row.absentDays || 0),
        holidays: Number(row.holidays || 0),
      };

      try {
        const summary = await getAttendanceSummaryForPeriod(authUid, row.month, row.year);
        if (summary) {
          attSummary = summary;
        }
      } catch (summaryErr) {
        console.error("Failed to load live attendance summary, using row values:", summaryErr);
      }

      const blob = await generatePayslipPDF({
        month: row.month,
        year: row.year,

        employee: {
          name,
          employee_id: eid,
          department: row.department || "",
          designation: row.designation || "",
          email: row.email || "",
          phone: row.phone || "",
          joiningDate: row.joiningDate || "",
          date_of_birth: row.date_of_birth || "",
          location: row.location || "",
          bank_name: row.bank_name || "",
          bank_account_no: row.bank_account_no || "",
          pan_no: row.pan_no || "",
          pf_no: row.pf_no || "",
          universal_account_number: row.universal_account_number || "",
        },

        salary: {
          monthlySalary: Number(row.monthlySalary || row.monthlysalary || row.salary || 0),
          yearlySalary: Number(row.yearlySalary || row.yearlysalary || Math.round((Number(row.monthlySalary || row.monthlysalary || row.salary || 0) * 12) * 100) / 100 || 0),
          basicSalary: Number(row.basicSalary || row.basicsalary || Math.round((Number(row.monthlySalary || row.monthlysalary || row.salary || 0) * 0.5) * 100) / 100 || 0),
          hra: Number(row.hra || Math.round((Number(row.monthlySalary || row.monthlysalary || row.salary || 0) * 0.3) * 100) / 100 || 0),
          otherAllowances: Number(row.otherAllowances || row.otherallowances || Math.round((Number(row.monthlySalary || row.monthlysalary || row.salary || 0) * 0.2) * 100) / 100 || 0),
          yearlyBasic: Number(row.yearlyBasic || row.yearlybasic || 0),
          yearlyHra: Number(row.yearlyHra || row.yearlyhra || 0),
          yearlyOtherAllowances: Number(row.yearlyOtherAllowances || row.yearlyotherallowances || 0),
        },

        attendance: attSummary,

        deductions: Number(row.deductions || 0),
        netSalary: Number(row.netSalary || 0),
        status: row.status || "Paid",
        appraisalApplied: Boolean(row.appraisalApplied),
        appraisalEffectiveFrom: row.appraisalEffectiveFrom || "",
      }, filename, true as any);

      if (blob) {
        // trigger browser download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        // upload to Supabase storage
        const path = `payslips/${payrollId ?? authUid}_${row.year}_${row.month}_${Date.now()}.pdf`;
        let storageUploaded = false;
        let publicUrl: string | null = null;

        try {
          const { error: uploadError } = await supabase.storage
            .from("payslips")
            .upload(path, blob, { upsert: true, contentType: "application/pdf" });
          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage.from("payslips").getPublicUrl(path);
          publicUrl = (publicData as any)?.publicUrl ?? null;
          storageUploaded = true;
        } catch (uploadErr: any) {
          const message = String(uploadErr?.message || uploadErr);
          if (message.includes("bucket not found") || message.includes("Bucket not found") || message.includes("does not exist")) {
            toast.warning("Payslip downloaded locally, but the Supabase storage bucket 'payslips' is not configured. Create the bucket or update the app storage settings.");
          } else {
            throw uploadErr;
          }
        }

        if (storageUploaded) {
          const payload = {
            payroll_id: payrollId,
            user_auth_uid: authUid,
            pdf_path: path,
            pdfUrl: publicUrl,
          };

          let saveError = null as any;
          if (payrollId) {
            const { error } = await supabase
              .from("payslips")
              .upsert([payload], { onConflict: "payroll_id" });
            saveError = error;
          } else {
            const { error } = await supabase
              .from("payslips")
              .insert(payload);
            saveError = error;
          }

          if (saveError) throw saveError;
          await onPayslipSaved?.();
          toast.success("Payslip downloaded and saved");
        } else {
          toast.success("Payslip downloaded locally");
        }
      } else {
        // fallback: generatePayslipPDF triggered download already
        toast.success("Payslip downloaded");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to download/save payslip");
    }
  };

  return (
    <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50/60">
              <th className="text-left px-5 py-3 font-medium text-slate-500">Period</th>
              {showEmployee && (
                <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
              )}
              <th className="text-left px-5 py-3 font-medium text-slate-500">Monthly Salary</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Std Days</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Std Hours</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Hourly Rate</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Worked Hours</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Overtime</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Gross</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Deductions</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Net Salary</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const displayName = r.name ?? employeeName ?? "—";
              const displayId = r.employee_id ?? employeeId ?? "";

              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {MONTHS[r.month - 1]} {r.year}
                  </td>

                  {showEmployee && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-brand grid place-items-center text-[10px] font-semibold text-white">
                          {initials(displayName)}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{displayName}</p>
                          <p className="text-[10px] text-slate-500">{displayId}</p>
                        </div>
                      </div>
                    </td>
                  )}

                  <td className="px-5 py-3">{fmtMoney(r.monthlySalary)}</td>
                  <td className="px-5 py-3">{r.standardWorkingDays || 25}</td>
                  <td className="px-5 py-3">{r.standardWorkingHours || 9}</td>
                  <td className="px-5 py-3">{fmtMoney(r.hourlyRate)}</td>
                  <td className="px-5 py-3">{formatHours(r.totalWorkedHours)}</td>
                  <td className="px-5 py-3">{formatHours(r.overtimeHours)}</td>
                  <td className="px-5 py-3">{fmtMoney(r.grossSalary)}</td>
                  <td className="px-5 py-3 text-rose-600">-{fmtMoney(r.deductions)}</td>
                  <td className="px-5 py-3 font-bold text-emerald-600">
                    {fmtMoney(r.netSalary)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={r.status} />
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => downloadPdf(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand bg-brand-soft hover:bg-brand-soft/80 transition"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      PDF
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={showEmployee ? 9 : 8}
                  className="text-center py-12 text-slate-500"
                >
                  <Wallet className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  No payroll records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}