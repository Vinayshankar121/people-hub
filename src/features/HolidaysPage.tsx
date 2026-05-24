import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/hrms/Modal";
import { fmtDate, HOLIDAY_TYPES } from "@/lib/hrms-utils";
import { toast } from "sonner";

type Holiday = {
  id: string;
  date: string;
  name: string;
  type: string;
};

export function HolidaysPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "Admin";
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", type: "National" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("holidays").select("*").order("date", { ascending: true });
    setHolidays((data as Holiday[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.date) {
      toast.error("Name and date are required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("holidays").insert({
        name: form.name,
        date: form.date,
        type: form.type,
      });
      if (error) throw error;
      toast.success("Holiday added");
      setShowModal(false);
      setForm({ name: "", date: "", type: "National" });
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Holiday deleted"); load(); }
  };

  const typeColor: Record<string, { bg: string; text: string; icon: string }> = {
    National: { bg: "bg-blue-50", text: "text-blue-700", icon: "bg-blue-100 text-blue-600" },
    Company: { bg: "bg-violet-50", text: "text-violet-700", icon: "bg-violet-100 text-violet-600" },
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Holiday Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">Corporate and National scheduled non-working days.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition">
            <Plus className="h-4 w-4" /> Add Holiday
          </button>
        )}
      </div>

      {/* Card Grid */}
      {holidays.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <CalendarDays className="h-14 w-14 mx-auto text-slate-300 mb-3" />
          <p className="text-lg font-medium">No holidays scheduled</p>
          <p className="text-sm">Holidays will appear here once added.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {holidays.map((h) => {
            const tc = typeColor[h.type] ?? typeColor.Company;
            return (
              <div key={h.id} className={`rounded-2xl ${tc.bg} p-5 relative group transition-shadow hover:shadow-md`}>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(h.id, h.name)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/80 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className={`h-10 w-10 rounded-xl ${tc.icon} grid place-items-center mb-3`}>
                  <CalendarDays className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900">{h.name}</h3>
                <span className={`inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${tc.bg} ${tc.text} ring-1 ring-inset ring-current/10`}>{h.type} Holiday</span>
                <p className="text-sm text-slate-600 mt-2">{fmtDate(h.date)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Holiday Modal */}
      <Modal open={showModal} title="Add Holiday" onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Holiday Name <span className="text-rose-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Christmas Day"' className="input-field" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Holiday Date <span className="text-rose-500">*</span></label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Holiday Type <span className="text-rose-500">*</span></label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field">
              {HOLIDAY_TYPES.map((t) => <option key={t} value={t}>{t} Holiday</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleAdd} disabled={saving} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {saving ? "Adding…" : "Add Holiday"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
