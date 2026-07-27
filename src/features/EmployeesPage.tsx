import { useEffect, useState, useMemo } from "react";
import { Users, Plus, Pencil, Trash2, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { DEPARTMENTS, fmtDate, fmtMoney, initials } from "@/lib/hrms-utils";
import { createEmployee, updateEmployee, deleteEmployee } from "@/lib/admin.functions";
import { toast } from "sonner";

type Employee = {
  id: string;
  auth_uid: string | null;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  joiningDate: string | null;
  salary: number;
  phone: string;
  role: "Admin" | "Employee" | "CEO";
  status?: "Active" | "Inactive";
  is_active?: boolean;

  date_of_birth?: string | null;
  bank_name?: string;
  bank_account_no?: string;
  pan_no?: string;
  location?: string;
  pf_no?: string;
  universal_account_number?: string;
};

const EMPTY_FORM = {
  employee_id: "",
  name: "",
  email: "",
  password: "",
  department: "Software Engineering",
  designation: "",
  salary: 0,
  joiningDate: new Date().toISOString().slice(0, 10),
  phone: "",
  role: "Employee" as "Admin" | "Employee" | "CEO",
  status: "Active" as "Active" | "Inactive",

  date_of_birth: null as string | null,
  bank_name: "",
  bank_account_no: "",
  pan_no: "",
  location: "",
  pf_no: "",
  universal_account_number: "",
};

const getEmpStatus = (emp: Employee): "Active" | "Inactive" => {
  if (emp.status === "Inactive" || emp.is_active === false) return "Inactive";
  return "Active";
};

export function EmployeesPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const { data: empData } = await supabase.from("employees").select("*").order("created_at", { ascending: true });

    let authUsersMap = new Map<string, any>();
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
      if (authData?.users) {
        authData.users.forEach((u) => authUsersMap.set(u.id, u));
      }
    } catch (e) {
      console.warn("Could not fetch auth users for employee status:", e);
    }

    const merged = (empData ?? []).map((emp: any) => {
      const authUser = emp.auth_uid ? authUsersMap.get(emp.auth_uid) : null;
      const metadata = authUser?.user_metadata ?? {};
      const isBanned = !!(authUser?.banned_until && new Date(authUser.banned_until) > new Date());

      const status: "Active" | "Inactive" =
        metadata.status ?? (isBanned ? "Inactive" : (emp.status === "Inactive" || emp.is_active === false ? "Inactive" : "Active"));
      const is_active = metadata.is_active ?? (status === "Active" && !isBanned);

      return {
        ...emp,
        status,
        is_active,
      };
    });

    setEmployees(merged as unknown as Employee[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = search.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
      const matchDept = deptFilter === "All" || e.department === deptFilter;
      const matchRole = roleFilter === "All" || e.role === roleFilter;
      const matchStatus = statusFilter === "All" || getEmpStatus(e) === statusFilter;
      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [employees, search, deptFilter, roleFilter, statusFilter]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setForm({
      ...EMPTY_FORM,
      employee_id: emp.employee_id,
      name: emp.name,
      email: emp.email,
      password: "",
      department: emp.department,
      designation: emp.designation,
      salary: emp.salary,
      joiningDate: emp.joiningDate?.slice(0, 10) ?? "",
      phone: emp.phone,
      role: emp.role,
      status: getEmpStatus(emp),

      date_of_birth: emp.date_of_birth ?? null,
      bank_name: emp.bank_name ?? "",
      bank_account_no: emp.bank_account_no ?? "",
      pan_no: emp.pan_no ?? "",
      location: emp.location ?? "",
      pf_no: emp.pf_no ?? "",
      universal_account_number: emp.universal_account_number ?? "",
    });
    setShowModal(true);
  };

  const toggleStatus = async (emp: Employee) => {
    if (!emp.auth_uid) return;
    const currentStatus = getEmpStatus(emp);
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";

    // Optimistic UI update
    setEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, status: newStatus, is_active: newStatus === "Active" } : e))
    );

    try {
      await updateEmployee({
        data: {
          auth_uid: emp.auth_uid,
          name: emp.name,
          department: emp.department,
          designation: emp.designation,
          salary: emp.salary,
          phone: emp.phone,
          role: emp.role,
          status: newStatus,
          is_active: newStatus === "Active",
        },
      });
      toast.success(`${emp.name} set to ${newStatus}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Status update failed");
      await load();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editTarget) {
        await updateEmployee({
          data: {
            auth_uid: editTarget.auth_uid!,
            name: form.name,
            department: form.department,
            designation: form.designation,
            salary: form.salary,
            phone: form.phone,
            role: form.role,
            status: form.status,
            is_active: form.status === "Active",
            joiningDate: form.joiningDate || undefined,
            password: form.password || undefined,

            date_of_birth: form.date_of_birth || undefined,
            pan_no: form.pan_no,
            location: form.location,
            pf_no: form.pf_no,

            universal_account_number: form.universal_account_number,
            bank_name: form.bank_name,
            bank_account_no: form.bank_account_no,
          },
        });
        toast.success("Employee updated successfully");
      } else {
        await createEmployee({
          data: {
            employee_id: form.employee_id,
            name: form.name,
            email: form.email,
            password: form.password || undefined,
            department: form.department,
            designation: form.designation,
            salary: form.salary,
            joiningDate: form.joiningDate || undefined,
            phone: form.phone,
            role: form.role,
            status: form.status,

            date_of_birth: form.date_of_birth || undefined,
            pan_no: form.pan_no,
            pf_no: form.pf_no,
            location: form.location,
            universal_account_number: form.universal_account_number,
            bank_name: form.bank_name,
            bank_account_no: form.bank_account_no,
          },
        });
        toast.success("Employee registered successfully");
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.auth_uid) return;
    setDeleting(true);
    try {
      await deleteEmployee({ data: { auth_uid: deleteTarget.auth_uid } });
      toast.success("Employee deleted");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (profile?.role !== "Admin" && profile?.role !== "CEO") return null;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Employee Directory</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your organization's workforce</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition shrink-0">
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
          <option value="All">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
          <option value="All">All Roles</option>
          <option value="Admin">Admin</option>
          <option value="CEO">CEO</option>
          <option value="Employee">Employee</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                <th className="text-left px-5 py-3 font-medium text-slate-500">Employee ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Department & Role</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Phone</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Salary</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Date of Birth</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">PAN</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">PF No</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">UAN</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Bank Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Bank Account #</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-slate-600">{emp.employee_id}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-brand grid place-items-center text-xs font-semibold text-white shrink-0">
                        {initials(emp.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{emp.name}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-slate-700">{emp.designation}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">{emp.department}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${emp.role === "Admin" ? "bg-violet-50 text-violet-700" : emp.role === "CEO" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{emp.role}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleStatus(emp)}
                      title="Click to toggle Active / Inactive status"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer hover:scale-105 ${
                        getEmpStatus(emp) === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${getEmpStatus(emp) === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {getEmpStatus(emp)}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{emp.phone || "—"}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{fmtMoney(emp.salary)}</td>
                  <td className="px-5 py-3 text-slate-600">{fmtDate(emp.date_of_birth ?? null)}</td>
                  <td className="px-5 py-3 text-slate-600">{emp.pan_no || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{emp.pf_no || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{emp.universal_account_number || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{emp.bank_name || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{emp.bank_account_no || "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(emp)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-brand transition">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        disabled={emp.auth_uid === profile?.auth_uid}
                        className="p-2 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-slate-500">
                    <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={showModal} title={editTarget ? "Edit Employee" : "Add New Employee"} onClose={() => setShowModal(false)} maxWidth="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Employee ID" required>
            <input disabled={!!editTarget} value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="TM001" className="input-field disabled:opacity-60" />
          </Field>
          <Field label="Full Name" required>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className="input-field" />
          </Field>
          <Field label="Email Address" required>
            <input type="email" disabled={!!editTarget} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john.doe@company.com" className="input-field disabled:opacity-60" />
          </Field>
          <Field label="Password" required={!editTarget}>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editTarget ? "Leave blank to keep unchanged" : "Leave blank for default (ID@123)"} className="input-field" />
          </Field>
          <Field label="Department" required>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input-field">
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Designation" required>
            <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="MERN Stack Lead" className="input-field" />
          </Field>
          <Field label="Base Salary (Rs.)" required>
            <input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} placeholder="75000" className="input-field" />
          </Field>
          <Field label="Joining Date" required>
            <input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="input-field" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" className="input-field" />
          </Field>
          <Field label="Access Role" required>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "Admin" | "Employee" | "CEO" })} className="input-field">
              <option value="Employee">Employee</option>
              <option value="CEO">CEO</option>
              <option value="Admin">Admin</option>
            </select>
          </Field>

          <Field label="Account Status" required>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "Active" | "Inactive" })}
              className={`input-field font-semibold ${
                form.status === "Active"
                  ? "border-emerald-300 text-emerald-700 bg-emerald-50/40"
                  : "border-rose-300 text-rose-700 bg-rose-50/40"
              }`}
            >
              <option value="Active">Active (Can Login & Access App)</option>
              <option value="Inactive">Inactive (Blocked from Login)</option>
            </select>
          </Field>

          <Field label="Date of Birth">
            <input type="date" value={form.date_of_birth ?? ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value || null })} className="input-field" />
          </Field>
          <Field label="PAN No">
            <input value={form.pan_no ?? ""} onChange={(e) => setForm({ ...form, pan_no: e.target.value })} placeholder="ABCDE1234F" className="input-field" />
          </Field>
          <Field label="Location">
            <input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bangalore" className="input-field" />
          </Field>
          <Field label="PF No">
            <input value={form.pf_no ?? ""} onChange={(e) => setForm({ ...form, pf_no: e.target.value })} placeholder="PF123456" className="input-field" />
          </Field>
          <Field label="UAN">
            <input value={form.universal_account_number ?? ""} onChange={(e) => setForm({ ...form, universal_account_number: e.target.value })} placeholder="UAN123456789" className="input-field" />
          </Field>
          <Field label="Bank Name">
            <input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="SBI" className="input-field" />
          </Field>
          <Field label="Bank Account #">
            <input value={form.bank_account_no ?? ""} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} placeholder="1234567890" className="input-field" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {saving ? "Saving…" : editTarget ? "Save Changes" : "Register Employee"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} title="Delete Employee" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete employee <strong>"{deleteTarget?.name}"</strong>? This action is irreversible.
        </p>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {deleting ? "Deleting…" : "Delete Employee"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
