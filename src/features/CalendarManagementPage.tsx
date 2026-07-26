import { useEffect, useState } from "react";
import { Calendar, Plus, Edit2, Trash2, Settings, Download, Upload, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { fmtDate } from "@/lib/hrms-utils";
import { getHolidayBadge, formatCalendarDate, getUpcomingHolidays } from "@/lib/calendar-system";
import { toast } from "sonner";

type Holiday = {
  id: string;
  date: string;
  name: string;
  category: "National" | "Public" | "Company" | "Optional" | "Weekend";
  description: string;
  is_full_day: boolean;
  is_optional: boolean;
};

type CalendarConfig = {
  id: string;
  company_name: string;
  weekend_days: string[];
  financial_year_start: number;
  max_paid_leaves_per_month: number;
  total_paid_leaves_per_year: number;
  enable_pf: boolean;
  enable_esi: boolean;
};

export function CalendarManagementPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "Admin" || profile?.role === "CEO";

  if (!isAdmin) return <div className="p-6 text-center text-slate-500">Admin/CEO access required</div>;

  return (
    <div className="space-y-8 max-w-7xl">
      <AdminCalendarDashboard />
    </div>
  );
}

function AdminCalendarDashboard() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"All" | "National" | "Public" | "Company" | "Optional">("All");

  const [form, setForm] = useState({
    name: "",
    date: "",
    category: "Company" as Holiday["category"],
    description: "",
    is_full_day: true,
    is_optional: false,
  });

  const [configForm, setConfigForm] = useState({
    weekend_days: ["Saturday", "Sunday"] as string[],
    max_paid_leaves_per_month: 2,
    total_paid_leaves_per_year: 24,
  });

  const load = async () => {
    try {
      const { data: hols } = await supabase.from("holidays").select("*").order("date", { ascending: true });
      setHolidays((hols ?? []) as Holiday[]);

      const { data: cfg } = await supabase.from("calendar_config").select("*").single();
      if (cfg) setConfig(cfg as CalendarConfig);
    } catch (err: any) {
      toast.error("Failed to load calendar data");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveHoliday = async () => {
    if (!form.name || !form.date) {
      toast.error("Name and date required");
      return;
    }

    setLoading(true);
    try {
      if (editingHoliday) {
        const { error } = await supabase
          .from("holidays")
          .update({
            name: form.name,
            date: form.date,
            category: form.category,
            description: form.description,
            is_full_day: form.is_full_day,
            is_optional: form.is_optional,
          })
          .eq("id", editingHoliday.id);

        if (error) throw error;
        toast.success("Holiday updated");
      } else {
        const { error } = await supabase.from("holidays").insert({
          name: form.name,
          date: form.date,
          category: form.category,
          description: form.description,
          is_full_day: form.is_full_day,
          is_optional: form.is_optional,
          type: form.category, // Legacy field
        });

        if (error) throw error;
        toast.success("Holiday added");
      }

      setShowHolidayModal(false);
      setEditingHoliday(null);
      setForm({
        name: "",
        date: "",
        category: "Company",
        description: "",
        is_full_day: true,
        is_optional: false,
      });
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save holiday");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!confirm(`Delete holiday "${name}"?`)) return;

    try {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
      toast.success("Holiday deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete holiday");
    }
  };

  const handleEditHoliday = (h: Holiday) => {
    setEditingHoliday(h);
    setForm({
      name: h.name,
      date: h.date,
      category: h.category,
      description: h.description,
      is_full_day: h.is_full_day,
      is_optional: h.is_optional,
    });
    setShowHolidayModal(true);
  };

  const filteredHolidays = filter === "All" ? holidays : holidays.filter((h) => h.category === filter);
  const upcoming = getUpcomingHolidays(holidays, 90);

  const statsCards = [
    { label: "Total Holidays", value: holidays.length, bg: "bg-blue-50", text: "text-blue-700" },
    { label: "National Holidays", value: holidays.filter((h) => h.category === "National").length, bg: "bg-red-50", text: "text-red-700" },
    { label: "Company Holidays", value: holidays.filter((h) => h.category === "Company").length, bg: "bg-green-50", text: "text-green-700" },
    { label: "Optional Holidays", value: holidays.filter((h) => h.is_optional).length, bg: "bg-purple-50", text: "text-purple-700" },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-8 w-8 text-brand" />
            Calendar Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage company holidays, events, and calendar configuration</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>

          <button
            onClick={() => {
              setEditingHoliday(null);
              setForm({
                name: "",
                date: "",
                category: "Company",
                description: "",
                is_full_day: true,
                is_optional: false,
              });
              setShowHolidayModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" />
            Add Holiday
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-2xl p-5 border`}>
            <p className={`text-sm font-medium ${card.text}`}>{card.label}</p>
            <p className={`text-3xl font-bold ${card.text} mt-2`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Holidays Widget */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-brand" />
          Upcoming Holidays (Next 90 Days)
        </h2>

        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming holidays scheduled</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((h) => {
              const badge = getHolidayBadge(h.category);
              return (
                <div key={h.id} className={`${badge.bg} rounded-xl px-4 py-3 flex items-center justify-between`}>
                  <div>
                    <p className={`font-medium ${badge.text}`}>{h.name}</p>
                    <p className="text-xs text-slate-600">{formatCalendarDate(h.date, "short")}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${badge.text} ${badge.bg}`}>{h.category}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Holidays Filter and List */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">All Holidays</h2>

          <div className="flex gap-2 flex-wrap">
            {(["All", "National", "Public", "Company", "Optional"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === cat
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/60">
                <th className="text-left px-6 py-3 font-medium text-slate-500">Date</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Holiday Name</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Category</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Description</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Type</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredHolidays.map((h) => {
                const badge = getHolidayBadge(h.category);
                return (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium">{formatCalendarDate(h.date, "short")}</td>
                    <td className="px-6 py-3">{h.name}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {h.category}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{h.description || "—"}</td>
                    <td className="px-6 py-3">
                      {h.is_optional && <Badge label="Optional" color="purple" />}
                      {h.is_full_day && <Badge label="Full Day" color="blue" />}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditHoliday(h)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-blue-100 hover:text-blue-600 transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-red-100 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Holiday Modal */}
      <Modal open={showHolidayModal} title={editingHoliday ? "Edit Holiday" : "Add Holiday"} onClose={() => setShowHolidayModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Holiday Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Diwali"
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="input-field mt-1">
              <option value="National">National Holiday</option>
              <option value="Public">Public Holiday</option>
              <option value="Company">Company Holiday</option>
              <option value="Optional">Optional Holiday</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description"
              className="input-field mt-1"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_full_day}
                onChange={(e) => setForm({ ...form, is_full_day: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-slate-600">Full Day Holiday</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_optional}
                onChange={(e) => setForm({ ...form, is_optional: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-slate-600">Optional</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowHolidayModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">
            Cancel
          </button>

          <button
            onClick={handleSaveHoliday}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Saving..." : "Save Holiday"}
          </button>
        </div>
      </Modal>

      {/* Calendar Config Modal */}
      <Modal open={showConfigModal} title="Calendar Settings" onClose={() => setShowConfigModal(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Configure weekend days and leave policies for your company.</p>

          <div>
            <label className="text-xs font-medium text-slate-600">Weekend Days</label>
            <div className="mt-2 space-y-2">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.weekend_days.includes(day)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfigForm({ ...configForm, weekend_days: [...configForm.weekend_days, day] });
                      } else {
                        setConfigForm({ ...configForm, weekend_days: configForm.weekend_days.filter((d) => d !== day) });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-600">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Paid Leaves Per Month</label>
            <input
              type="number"
              value={configForm.max_paid_leaves_per_month}
              onChange={(e) => setConfigForm({ ...configForm, max_paid_leaves_per_month: Number(e.target.value) })}
              min="0"
              max="10"
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Total Paid Leaves Per Year</label>
            <input
              type="number"
              value={configForm.total_paid_leaves_per_year}
              onChange={(e) => setConfigForm({ ...configForm, total_paid_leaves_per_year: Number(e.target.value) })}
              min="0"
              max="50"
              className="input-field mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">
            Cancel
          </button>

          <button className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition">
            Save Settings
          </button>
        </div>
      </Modal>
    </>
  );
}
