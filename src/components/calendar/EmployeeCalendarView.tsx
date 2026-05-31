import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, AlertCircle, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateCalendarMonth, getHolidayBadge, formatCalendarDate, calculateWorkingDays } from "@/lib/calendar-system";
import type { Holiday, CalendarDay, CalendarMonth } from "@/lib/calendar-system";

interface CalendarViewProps {
  mode?: "month" | "week" | "year";
  showHolidays?: boolean;
  showLeaves?: boolean;
  showStats?: boolean;
}

export function EmployeeCalendarView({ mode = "month", showHolidays = true, showLeaves = true, showStats = true }: CalendarViewProps) {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState<CalendarMonth | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<string[]>([]);
  const [weekendDays, setWeekendDays] = useState(["Saturday", "Sunday"]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: hols } = await supabase.from("holidays").select("*");
      setHolidays((hols ?? []) as Holiday[]);

      const { data: cfg } = await supabase.from("calendar_config").select("weekend_days").single();
      if (cfg?.weekend_days) setWeekendDays(cfg.weekend_days);

      if (profile?.id) {
        const { data: leaves } = await supabase
          .from("leaves")
          .select("start_date, end_date")
          .eq("user_auth_uid", profile.id)
          .eq("status", "Approved");

        const leaveDates: string[] = [];
        for (const leave of leaves ?? []) {
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            leaveDates.push(d.toISOString().slice(0, 10));
          }
        }
        setApprovedLeaves(leaveDates);
      }

      const month = generateCalendarMonth(currentDate.getFullYear(), currentDate.getMonth() + 1, weekendDays, holidays);
      setCalendarMonth(month);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentDate, profile?.id]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  if (loading || !calendarMonth) return <div className="p-6 text-center text-slate-500">Loading calendar...</div>;

  const renderCalendarDay = (day: CalendarDay) => {
    const isLeaveDay = approvedLeaves.includes(day.date);
    const holiday = day.holiday;

    let bgColor = "bg-white";
    let textColor = "text-slate-900";
    let borderColor = "border";

    if (day.isToday) {
      bgColor = "bg-blue-50";
      borderColor = "border-blue-200";
    } else if (day.isWeekend) {
      bgColor = "bg-slate-50";
      textColor = "text-slate-400";
    } else if (isLeaveDay) {
      bgColor = "bg-amber-50";
      borderColor = "border-amber-200";
    } else if (day.isHoliday) {
      const badge = getHolidayBadge(holiday?.category || "Weekend");
      bgColor = badge.bg;
      textColor = badge.text;
    }

    return (
      <div
        key={day.date}
        className={`min-h-24 p-2 ${bgColor} ${borderColor} border rounded-lg flex flex-col transition-all hover:shadow-md`}
      >
        <div className={`text-sm font-semibold ${textColor}`}>{day.dayOfMonth}</div>

        {isLeaveDay && <div className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded mt-1">🌴 Leave</div>}

        {day.isHoliday && holiday && (
          <div className="text-xs font-medium px-1.5 py-0.5 rounded mt-1 truncate" title={holiday.name}>
            {getHolidayBadge(holiday.category).icon} {holiday.name}
          </div>
        )}

        {day.isWeekend && !day.isHoliday && <div className="text-xs text-slate-500 mt-1">Weekend</div>}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-brand" />
              {calendarMonth.monthName} {calendarMonth.year}
            </h2>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-slate-200 transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white text-slate-700 hover:bg-slate-100 transition border"
            >
              Today
            </button>

            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-slate-200 transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {showStats && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <StatCard label="Working Days" value={calendarMonth.workingDays} icon="📅" />
            <StatCard label="Holidays" value={calendarMonth.holidayCount} icon="🎉" />
            <StatCard label="Weekends" value={calendarMonth.weekendDays} icon="😴" />
            <StatCard label="Your Leaves" value={approvedLeaves.filter((d) => d.substring(0, 7) === `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}`).length} icon="🌴" />
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center font-semibold text-slate-600 text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: calendarMonth.days[0]?.dayOfWeek || 0 }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-24 bg-slate-50 rounded-lg opacity-50" />
          ))}

          {/* Calendar days */}
          {calendarMonth.days.map(renderCalendarDay)}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-4 bg-slate-50 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <LegendItem icon="🎉" label="Holiday" color="bg-red-100" />
        <LegendItem icon="🌴" label="Your Leave" color="bg-amber-100" />
        <LegendItem icon="😴" label="Weekend" color="bg-gray-100" />
        <LegendItem icon="📅" label="Working Day" color="bg-white" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-lg p-3 border text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function LegendItem({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded ${color}`} />
      <span>{icon} {label}</span>
    </div>
  );
}

// Calendar Dashboard Widget
export function CalendarDashboardWidget() {
  const { profile } = useAuth();
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState(0);
  const [remainingLeaves, setRemainingLeaves] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const futureDateStr = futureDate.toISOString().slice(0, 10);

        const { data: hols } = await supabase
          .from("holidays")
          .select("*")
          .gte("date", today)
          .lte("date", futureDateStr)
          .order("date", { ascending: true })
          .limit(5);

        setUpcomingHolidays((hols ?? []) as Holiday[]);

        if (profile?.id) {
          const { data: leaves } = await supabase
            .from("leaves")
            .select("days_count")
            .eq("user_auth_uid", profile.id)
            .eq("status", "Approved")
            .gte("start_date", today);

          const approved = (leaves ?? []).reduce((sum, l) => sum + (l.days_count || 0), 0);
          setApprovedLeaves(approved);

          // Calculate remaining leaves (24 per year - used)
          setRemainingLeaves(Math.max(0, 24 - approved));
        }
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, [profile?.id]);

  return (
    <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-brand" />
        Calendar & Leave Summary
      </h3>

      {/* Leave Balances */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-blue-600 font-medium">Approved Leaves</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{approvedLeaves} days</p>
        </div>

        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-xs text-green-600 font-medium">Remaining Leaves</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{remainingLeaves} days</p>
        </div>
      </div>

      {/* Upcoming Holidays */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Upcoming Holidays</h4>

        {upcomingHolidays.length === 0 ? (
          <p className="text-xs text-slate-500">No holidays scheduled soon</p>
        ) : (
          <div className="space-y-2">
            {upcomingHolidays.map((h) => {
              const badge = getHolidayBadge(h.category);
              return (
                <div key={h.id} className={`${badge.bg} rounded-lg px-3 py-2 text-xs flex justify-between items-center`}>
                  <span className={`font-medium ${badge.text}`}>{h.name}</span>
                  <span className="text-slate-600">{formatCalendarDate(h.date, "short")}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 pt-2 border-t flex items-center gap-1">
        <Zap className="h-3 w-3" />
        2 free paid leaves per month · No PF/ESI deductions
      </div>
    </div>
  );
}
