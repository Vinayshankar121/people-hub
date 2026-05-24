import { useEffect, useState } from "react";
import { LogIn, LogOut, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { initials, todayISO, calcHours } from "@/lib/hrms-utils";

export function Navbar() {
  const { profile } = useAuth();
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
    <header className="h-20 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Welcome back, {profile?.name?.split(" ")[0] ?? "User"}
        </h1>
        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
          <Clock className="h-3 w-3" />
          {now.toLocaleString("en-US", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {profile?.role === "Employee" && (
          <div className="flex items-center gap-2">
            <button
              onClick={punchIn}
              disabled={!!today?.punch_in_time}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="h-4 w-4" />
              {today?.punch_in_time ? `In: ${today.punch_in_time}` : "Punch In"}
            </button>
            <button
              onClick={punchOut}
              disabled={!today?.punch_in_time || !!today?.punch_out_time}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="h-4 w-4" />
              {today?.punch_out_time ? `Out: ${today.punch_out_time}` : "Punch Out"}
            </button>
          </div>
        )}
        <div className="h-10 w-10 rounded-full bg-brand grid place-items-center text-sm font-semibold text-white">
          {initials(profile?.name)}
        </div>
      </div>
    </header>
  );
}
