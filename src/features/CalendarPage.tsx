import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar as CalIcon, Plus, Megaphone, CalendarPlus } from "lucide-react";
import { Calendar as BigCalendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";
import { Modal } from "@/components/hrms/Modal";
import { toast } from "sonner";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

type CalEvent = Event & { color?: string; category?: string };

const EVENT_COLORS: Record<string, string> = {
  Holiday: "#10B981",
  Event: "#8B5CF6",
  Announcement: "#EC4899",
  Leave: "#F59E0B",
  Present: "#3B82F6",
  Absent: "#EF4444",
};

export function CalendarPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "Admin" || profile?.role === "CEO";
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [employees, setEmployees] = useState<{ auth_uid: string; name: string; employee_id: string }[]>([]);
  const [empFilter, setEmpFilter] = useState("All");
  const [date, setDate] = useState(new Date());

  // Modal State for Adding Event / Announcement
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", type: "Event" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const month = date.getMonth();
    const year = date.getFullYear();
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const allEvents: CalEvent[] = [];

    // Holidays and calendar events are separate Supabase resources.
    const { data: holidays, error: holErr } = await supabase.from("holidays").select("*");
    if (holErr) {
      console.warn("Error fetching calendar events/holidays:", holErr);
    }

    for (const h of holidays ?? []) {
      const type = h.type || "Holiday";
      let emoji = "🎉";
      let color = EVENT_COLORS.Holiday;

      if (type === "Event") {
        emoji = "🎈";
        color = EVENT_COLORS.Event;
      } else if (type === "Announcement") {
        emoji = "📢";
        color = EVENT_COLORS.Announcement;
      } else if (type === "Company") {
        emoji = "🏢";
        color = EVENT_COLORS.Holiday;
      }

      allEvents.push({
        title: `${emoji} ${h.name}`,
        start: new Date(h.date + "T00:00:00"),
        end: new Date(h.date + "T23:59:59"),
        color: color,
        category: type,
      });
    }

    const { data: calendarEvents, error: eventsError } = await supabase
      .from("calendar_events")
      .select("*")
      .lte("start_date", end)
      .gte("end_date", start);
    if (eventsError) {
      console.warn("Error fetching company events and announcements:", eventsError);
    }

    for (const item of calendarEvents ?? []) {
      const isAnnouncement = item.event_type === "announcement";
      allEvents.push({
        title: `${isAnnouncement ? "📢" : "🎈"} ${item.title}`,
        start: new Date(`${item.start_date}T00:00:00`),
        end: new Date(`${item.end_date}T23:59:59`),
        color: isAnnouncement
          ? EVENT_COLORS.Announcement
          : EVENT_COLORS.Event,
        category: isAnnouncement ? "Announcement" : "Event",
      });
    }

    // Attendance + Leaves
    if (isAdmin) {
      let { data: allEmps, error: employeesError } = await supabase
        .from("employees")
        .select("*")
        .order("name", { ascending: true });

      // Admin calendars must still be able to populate the filter when the
      // regular client is restricted by an employees-table RLS policy.
      if (employeesError) {
        const adminResult = await supabaseAdmin
          .from("employees")
          .select("*")
          .order("name", { ascending: true });
        allEmps = adminResult.data;
        employeesError = adminResult.error;
      }

      if (employeesError) {
        console.warn("Error fetching employees for calendar filter:", employeesError);
      }

      const emps = (allEmps ?? []).filter((e: any) => {
        if (!e.auth_uid || !e.name) return false;
        if (e.role === "Admin" || e.role === "CEO") return false;
        const isMetaActive = e.status === "Active" || e.is_active === true || e.employment_status === "Active";
        const isMetaInactive = e.status === "Inactive" || e.is_active === false || e.employment_status === "Inactive";
        return isMetaActive && !isMetaInactive;
      });
      setEmployees(emps as any);

      let attQ = supabase.from("attendance").select("*, employees!attendance_user_auth_uid_fkey(name)").gte("date", start).lte("date", end);
      if (empFilter !== "All") attQ = attQ.eq("user_auth_uid", empFilter);
      const { data: att } = await attQ;

      for (const a of att ?? []) {
        const empName = (a as any).employees?.name ?? "";
        if (a.status === "Leave") {
          allEvents.push({
            title: `🌴 ${empName}`,
            start: new Date(a.date + "T00:00:00"),
            end: new Date(a.date + "T23:59:59"),
            color: EVENT_COLORS.Leave,
            category: "Leave",
          });
        } else if (a.status === "Present") {
          allEvents.push({
            title: `✓ ${empName}`,
            start: new Date(a.date + "T00:00:00"),
            end: new Date(a.date + "T23:59:59"),
            color: EVENT_COLORS.Present,
            category: "Present",
          });
        } else if (a.status === "Absent") {
          allEvents.push({
            title: `✗ ${empName}`,
            start: new Date(a.date + "T00:00:00"),
            end: new Date(a.date + "T23:59:59"),
            color: EVENT_COLORS.Absent,
            category: "Absent",
          });
        }
      }

      // Approved leaves
      let leaveQ = supabase.from("leaves").select("*, employees!leaves_user_auth_uid_fkey(name)").eq("status", "Approved");
      if (empFilter !== "All") leaveQ = leaveQ.eq("user_auth_uid", empFilter);
      const { data: leaves } = await leaveQ;
      for (const l of leaves ?? []) {
        const s = new Date(l.start_date);
        const e = new Date(l.end_date);
        if (s <= new Date(end) && e >= new Date(start)) {
          allEvents.push({
            title: `🌴 ${(l as any).employees?.name ?? ""} — ${l.type}`,
            start: s,
            end: e,
            color: EVENT_COLORS.Leave,
            category: "Leave",
          });
        }
      }
    } else {
      // Employee view: own data
      const { data: att } = await supabase.from("attendance").select("*")
        .eq("user_auth_uid", profile.auth_uid).gte("date", start).lte("date", end);
      for (const a of att ?? []) {
        if (a.status === "Leave") {
          allEvents.push({
            title: "🌴 On Leave",
            start: new Date(a.date + "T00:00:00"),
            end: new Date(a.date + "T23:59:59"),
            color: EVENT_COLORS.Leave,
            category: "Leave",
          });
        } else if (a.status === "Present") {
          allEvents.push({
            title: `✓ Present ${a.punch_in_time ? `(${a.punch_in_time})` : ""}`,
            start: new Date(a.date + "T00:00:00"),
            end: new Date(a.date + "T23:59:59"),
            color: EVENT_COLORS.Present,
            category: "Present",
          });
        } else if (a.status === "Absent") {
          allEvents.push({
            title: "✗ Absent",
            start: new Date(a.date + "T00:00:00"),
            end: new Date(a.date + "T23:59:59"),
            color: EVENT_COLORS.Absent,
            category: "Absent",
          });
        }
      }
    }

    setEvents(allEvents);
  }, [profile, isAdmin, date, empFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreateEvent = async () => {
    if (!profile) {
      toast.error("Your employee profile is not available");
      return;
    }
    if (!form.name || !form.date) {
      toast.error("Title and Date are required");
      return;
    }
    setSaving(true);
    try {
      if (form.type === "Event" || form.type === "Announcement") {
        const payload = {
          title: form.name,
          description: "",
          start_date: form.date,
          end_date: form.date,
          start_time: null,
          end_time: null,
          event_type:
            form.type === "Announcement" ? "announcement" : "company",
          location: null,
          created_by: profile.auth_uid,
          visibility: "all",
        };
        let { error } = await supabase.from("calendar_events").insert(payload);
        if (error) {
          const adminResult = await supabaseAdmin
            .from("calendar_events")
            .insert(payload);
          error = adminResult.error;
        }
        if (error) throw error;
      } else {
        let { error } = await supabase.from("holidays").insert({
          name: form.name,
          date: form.date,
          type: form.type,
        });
        if (error) {
          const adminResult = await supabaseAdmin.from("holidays").insert({
            name: form.name,
            date: form.date,
            type: form.type,
          });
          error = adminResult.error;
        }
        if (error) throw error;
      }

      toast.success(`${form.type} created successfully!`);
      setShowModal(false);
      setForm({ name: "", date: "", type: "Event" });
      await load();
    } catch (err: any) {
      console.error("Failed creating calendar item:", err);
      toast.error(err.message ?? "Failed to create event/announcement");
    } finally {
      setSaving(false);
    }
  };

  const eventStyleGetter = useCallback((event: CalEvent) => ({
    style: {
      backgroundColor: event.color ?? "#3B82F6",
      borderRadius: "6px",
      color: "white",
      border: "none",
      fontSize: "11px",
      padding: "2px 6px",
    },
  }), []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Interactive Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">Unified view of holidays, company events, announcements, and schedules.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add Event / Announcement
              </button>

              <select
                value={empFilter}
                onChange={(e) => setEmpFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="All">All Employees</option>
                {employees.map((em) => (
                  <option key={em.auth_uid} value={em.auth_uid}>
                    {em.name} ({em.employee_id})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 sm:gap-4 bg-white p-3.5 rounded-xl border">
        {[
          { label: "Holidays", color: EVENT_COLORS.Holiday, emoji: "🎉" },
          { label: "Events", color: EVENT_COLORS.Event, emoji: "🎈" },
          { label: "Announcements", color: EVENT_COLORS.Announcement, emoji: "📢" },
          { label: "Approved Leaves", color: EVENT_COLORS.Leave, emoji: "🌴" },
          { label: "Present", color: EVENT_COLORS.Present, emoji: "✓" },
          { label: "Absent", color: EVENT_COLORS.Absent, emoji: "✗" },
        ].map(({ label, color, emoji }) => (
          <div key={label} className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <div className="h-3 w-3 rounded-sm shadow-sm" style={{ backgroundColor: color }} />
            <span>{emoji} {label}</span>
          </div>
        ))}
      </div>

      <div className="h-[400px] sm:h-[500px] lg:h-[650px] bg-white p-4 rounded-2xl border">
        <BigCalendar
          localizer={localizer}
          events={events}
          date={date}
          onNavigate={setDate}
          view="month"
          views={["month"]}
          eventPropGetter={eventStyleGetter}
          popup
          style={{ height: "100%" }}
        />
      </div>

      {/* Add Event / Announcement Modal */}
      <Modal open={showModal} title="Add Event, Announcement, or Holiday" onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Title / Name <span className="text-rose-500">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder='e.g. "Annual Tech Summit" or "Diwali Holiday"'
              className="input-field"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Date <span className="text-rose-500">*</span></label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Category Type <span className="text-rose-500">*</span></label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="input-field"
            >
              <option value="Event">🎈 Event (Company Event)</option>
              <option value="Announcement">📢 Announcement (General Announcement)</option>
              <option value="National">🎉 National Holiday</option>
              <option value="Company">🏢 Company Holiday</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateEvent}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save to Calendar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
