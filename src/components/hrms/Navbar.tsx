import { useEffect, useState } from "react";
import { LogIn, LogOut, Clock, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { initials, todayISO, calcHours } from "@/lib/hrms-utils";
import { useSidebar } from "./Sidebar";

export function Navbar() {
  const { profile } = useAuth();
  const { toggle } = useSidebar();
  const [today, setToday] = useState<{ punch_in_time: string; punch_out_time: string } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadToday = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("attendance")
      .select("punch_in_time, punch_out_time")
      .eq("user_auth_uid", profile.auth_uid)
      .eq("date", todayISO())
      .maybeSingle();
    setToday(data ?? null);
  };

  useEffect(() => {
    if (profile?.role === "Employee") loadToday();
  }, [profile]);

  const punchIn = async () => {
    if (!profile) return;
    const time = new Date().toTimeString().slice(0, 5);
    await supabase.from("attendance").upsert(
      {
        user_auth_uid: profile.auth_uid,
        date: todayISO(),
        punch_in_time: time,
        status: "Present",
        approval_status: "Approved",
      },
      { onConflict: "user_auth_uid,date" }
    );
    loadToday();
  };

  const punchOut = async () => {
    if (!profile || !today?.punch_in_time) return;
    const time = new Date().toTimeString().slice(0, 5);
    const hours = calcHours(today.punch_in_time, time);
    await supabase
      .from("attendance")
      .update({ punch_out_time: time, total_hours: hours })
      .eq("user_auth_uid", profile.auth_uid)
      .eq("date", todayISO());
    loadToday();
  };

  return (
    <header className="h-auto min-h-[3.5rem] sm:min-h-[4rem] bg-white border-b px-4 sm:px-6 lg:px-8 py-3 sm:py-0 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-30">
      {/* Left: hamburger + greeting */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button onClick={toggle} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600">
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-semibold text-slate-900 truncate">
            Welcome, {profile?.name?.split(" ")[0] ?? "User"}
          </h1>
          <p className="hidden sm:flex text-xs text-slate-500 items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3" />
            {now.toLocaleString("en-US", {
              weekday: "long", day: "2-digit", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Right: punch buttons + avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {profile?.role === "Employee" && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={punchIn}
              disabled={!!today?.punch_in_time}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">{today?.punch_in_time ? `In: ${today.punch_in_time}` : "Punch In"}</span>
              <span className="xs:hidden">{today?.punch_in_time ? today.punch_in_time : "In"}</span>
            </button>
            <button
              onClick={punchOut}
              disabled={!today?.punch_in_time || !!today?.punch_out_time}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-rose-600 text-white text-xs sm:text-sm font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">{today?.punch_out_time ? `Out: ${today.punch_out_time}` : "Punch Out"}</span>
              <span className="xs:hidden">{today?.punch_out_time ? today.punch_out_time : "Out"}</span>
            </button>
          </div>
        )}
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-brand grid place-items-center text-xs sm:text-sm font-semibold text-white shrink-0">
          {initials(profile?.name)}
        </div>
      </div>
    </header>
  );
}
