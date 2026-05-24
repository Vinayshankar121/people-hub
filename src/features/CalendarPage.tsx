import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar as CalIcon } from "lucide-react";
import { Calendar as BigCalendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
  Leave: "#F59E0B",
  Present: "#3B82F6",
  Absent: "#EF4444",
};

export function CalendarPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "Admin";
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [employees, setEmployees] = useState<{ auth_uid: string; name: string; employee_id: string }[]>([]);
  const [empFilter, setEmpFilter] = useState("All");
  const [date, setDate] = useState(new Date());

  const load = useCallback(async () => {
    if (!profile) return;
    const month = date.getMonth();
    const year = date.getFullYear();
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const allEvents: CalEvent[] = [];

    // Holidays
    const { data: holidays } = await supabase.from("holidays").select("*").gte("date", start).lte("date", end);
    for (const h of holidays ?? []) {
      allEvents.push({
        title: `🎉 ${h.name}`,
        start: new Date(h.date + "T00:00:00"),
        end: new Date(h.date + "T23:59:59"),
        color: EVENT_COLORS.Holiday,
        category: "Holiday",
      });
    }

    // Attendance + Leaves
    if (isAdmin) {
      const { data: emps } = await supabase.from("employees").select("auth_uid, name, employee_id");
      setEmployees((emps ?? []) as any);

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
          <h1 className="text-2xl font-bold text-slate-900">Interactive Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">Unified view of holidays, leaves, and schedules.</p>
        </div>
        {isAdmin && (
          <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="All">All Events</option>
            {employees.map((em) => <option key={em.auth_uid} value={em.auth_uid}>{em.name} ({em.employee_id})</option>)}
          </select>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: "Holidays", color: EVENT_COLORS.Holiday, emoji: "🎉" },
          { label: "Approved Leaves", color: EVENT_COLORS.Leave, emoji: "🌴" },
          { label: "Present", color: EVENT_COLORS.Present, emoji: "✓" },
          { label: "Absent", color: EVENT_COLORS.Absent, emoji: "✗" },
        ].map(({ label, color, emoji }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-slate-600">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            <span>{emoji} {label}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 650 }}>
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
    </div>
  );
}
