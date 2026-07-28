import { useEffect, useState } from "react";
import { LogIn, LogOut, Clock, Menu, Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { initials, todayISO, calcHours } from "@/lib/hrms-utils";
import { getCurrentLocation } from "@/lib/geo";
import { toast } from "sonner";
import { useSidebar } from "./Sidebar";

export function Navbar() {
  const { profile } = useAuth();
  const { toggle } = useSidebar();
  const { settings, isWorkingDay } = useSettings();
  const [today, setToday] = useState<{ punch_in_time: string; punch_out_time: string } | null>(null);
  const [now, setNow] = useState(new Date());
  const [locating, setLocating] = useState(false);

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

  const isGpsRequired = profile?.gps_enabled !== false && settings.geo.enableGpsRestriction !== false;

  const verifyGpsLocation = async () => {
    if (!isGpsRequired) return null;
    setLocating(true);
    try {
      toast.info("Verifying live GPS location for office geofence...");
      const result = await getCurrentLocation(
        settings.geo.officeLat,
        settings.geo.officeLng,
        settings.geo.allowedRadiusMeters
      );

      if (!result.isWithinRadius) {
        const geoBlockMsg = "You are outside the office location. Please move within the permitted area.";
        toast.error(geoBlockMsg);
        alert(geoBlockMsg);
        return false;
      }
      return result;
    } catch (geoErr: any) {
      const rawMsg = geoErr?.message || "";
      let errorMsg = "Unable to detect your current location.";
      if (rawMsg.toLowerCase().includes("permission")) {
        errorMsg = "Location permission is required for attendance.";
      } else if (
        rawMsg.toLowerCase().includes("detect") ||
        rawMsg.toLowerCase().includes("unavailable") ||
        rawMsg.toLowerCase().includes("timed out") ||
        rawMsg.toLowerCase().includes("supported")
      ) {
        errorMsg = "Unable to detect your current location.";
      } else if (rawMsg) {
        errorMsg = rawMsg;
      }
      toast.error(errorMsg);
      alert(errorMsg);
      return false;
    } finally {
      setLocating(false);
    }
  };

  const punchIn = async () => {
    if (!profile) return;
    if (profile.is_active === false || profile.employment_status === "Inactive") {
      toast.error("Attendance is disabled because your account is inactive.");
      alert("Attendance is disabled because your account is inactive.");
      return;
    }

    const dateISO = todayISO();
    if (!isWorkingDay(dateISO)) {
      alert("Attendance is not allowed today (Weekend or Holiday).");
      return;
    }

    const time = new Date().toTimeString().slice(0, 5);
    const startTime = settings.attendance.startTime || "09:00";
    const lateThreshold = settings.attendance.lateThreshold || "09:15";

    if (time < startTime || time > lateThreshold) {
      alert(`Punch In is only allowed between ${startTime} and ${lateThreshold}.`);
      return;
    }

    let locationResult: any = null;
    if (isGpsRequired) {
      const gpsCheck = await verifyGpsLocation();
      if (gpsCheck === false) return;
      locationResult = gpsCheck;
    }

    try {
      const payload: any = {
        user_auth_uid: profile.auth_uid,
        date: dateISO,
        punch_in_time: time,
        status: "Present",
        approval_status: "Approved",
        gps_enabled: isGpsRequired,
      };

      if (locationResult) {
        payload.latitude = locationResult.latitude;
        payload.longitude = locationResult.longitude;
        payload.accuracy = locationResult.accuracy;
        payload.distance_meters = locationResult.distanceMeters;
      } else {
        payload.latitude = null;
        payload.longitude = null;
        payload.accuracy = null;
        payload.distance_meters = null;
      }

      const { error: upsertErr } = await supabase.from("attendance").upsert(
        payload,
        { onConflict: "user_auth_uid,date" }
      );

      if (upsertErr) {
        const fallbackPayload = {
          user_auth_uid: profile.auth_uid,
          date: dateISO,
          punch_in_time: time,
          status: "Present",
          approval_status: "Approved",
        };
        const { error: fallbackErr } = await supabase.from("attendance").upsert(
          fallbackPayload,
          { onConflict: "user_auth_uid,date" }
        );
        if (fallbackErr) throw fallbackErr;
      }

      const successMsg = isGpsRequired && locationResult
        ? `Punched In successfully! (${locationResult.distanceMeters}m from office)`
        : `Punched In successfully!`;
      toast.success(successMsg);
      loadToday();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record Punch In.");
      alert(err?.message || "Failed to record Punch In.");
    }
  };

  const punchOut = async () => {
    if (!profile || !today?.punch_in_time) return;
    if (profile.is_active === false || profile.employment_status === "Inactive") {
      toast.error("Attendance is disabled because your account is inactive.");
      alert("Attendance is disabled because your account is inactive.");
      return;
    }

    const dateISO = todayISO();
    if (!isWorkingDay(dateISO)) {
      alert("Attendance is not allowed today (Weekend or Holiday).");
      return;
    }

    const time = new Date().toTimeString().slice(0, 5);
    const checkoutMax = settings.attendance.checkoutMaxTime || "18:30";

    if (time > checkoutMax) {
      alert(`Punch Out is allowed up to ${checkoutMax}.`);
      return;
    }

    let locationResult: any = null;
    if (isGpsRequired) {
      const gpsCheck = await verifyGpsLocation();
      if (gpsCheck === false) return;
      locationResult = gpsCheck;
    }

    const hours = calcHours(today.punch_in_time, time);
    let status = "Half Day";
    if (today.punch_in_time <= (settings.attendance.lateThreshold || "09:15") && time >= (settings.attendance.endTime || "18:00")) {
      status = "Present";
    }

    const updatePayload: any = {
      punch_out_time: time,
      total_hours: hours,
      status,
      gps_enabled: isGpsRequired,
    };

    if (locationResult) {
      updatePayload.latitude = locationResult.latitude;
      updatePayload.longitude = locationResult.longitude;
      updatePayload.accuracy = locationResult.accuracy;
      updatePayload.distance_meters = locationResult.distanceMeters;
    }

    const { error: updateError } = await supabase
      .from("attendance")
      .update(updatePayload)
      .eq("user_auth_uid", profile.auth_uid)
      .eq("date", todayISO());

    if (updateError) {
      const fallbackPayload: any = {
        punch_out_time: time,
        total_hours: hours,
        status,
      };
      const { error: fallbackError } = await supabase
        .from("attendance")
        .update(fallbackPayload)
        .eq("user_auth_uid", profile.auth_uid)
        .eq("date", todayISO());
      if (fallbackError) {
        toast.error(fallbackError.message || "Failed to record Punch Out.");
        alert(fallbackError.message || "Failed to record Punch Out.");
        return;
      }
    }

    toast.success("Punched Out successfully!");
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
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-lg font-semibold text-slate-900 truncate">
              Welcome, {profile?.name?.split(" ")[0] ?? "User"}
            </h1>
            {profile?.role === "Employee" && (
              profile.gps_enabled !== false ? (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0" title="GPS Verification Required">
                  <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                  GPS: Enabled
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0" title="GPS Verification Disabled">
                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                  GPS: Disabled
                </span>
              )
            )}
          </div>
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
        {profile?.role === "Employee" && (() => {
          const currentTimeStr = now.toTimeString().slice(0, 5);
          const isNonWorkingDay = !isWorkingDay(todayISO());
          const isBeforePunchIn = currentTimeStr < (settings.attendance.startTime || "09:00");
          const isAfterPunchIn = currentTimeStr > (settings.attendance.lateThreshold || "09:15");
          const isExceeded = !isNonWorkingDay && isAfterPunchIn && !today?.punch_in_time;
          const checkoutMax = settings.attendance.checkoutMaxTime || "18:30";
          const isPunchOutExceeded = !isNonWorkingDay && currentTimeStr > checkoutMax && today?.punch_in_time && !today?.punch_out_time;

          return (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {isNonWorkingDay && (
                <span className="text-xs text-purple-700 font-medium bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
                  Non-working Day / Weekend
                </span>
              )}
              {isExceeded && (
                <span className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl">
                  Check-in time exceeded. Please contact Admin.
                </span>
              )}
              {isPunchOutExceeded && (
                <span className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  Check-out time ({checkoutMax}) exceeded.
                </span>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={punchIn}
                  disabled={isNonWorkingDay || !!today?.punch_in_time || isBeforePunchIn || isAfterPunchIn || locating}
                  className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {locating ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  <span className="hidden xs:inline">{locating ? "Verifying GPS..." : today?.punch_in_time ? `In: ${today.punch_in_time}` : "Punch In"}</span>
                  <span className="xs:hidden">{locating ? "GPS..." : today?.punch_in_time ? today.punch_in_time : "In"}</span>
                </button>
                <button
                  onClick={punchOut}
                  disabled={isNonWorkingDay || !today?.punch_in_time || !!today?.punch_out_time || currentTimeStr > checkoutMax}
                  className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-rose-600 text-white text-xs sm:text-sm font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">{today?.punch_out_time ? `Out: ${today.punch_out_time}` : "Punch Out"}</span>
                  <span className="xs:hidden">{today?.punch_out_time ? today.punch_out_time : "Out"}</span>
                </button>
              </div>
            </div>
          );
        })()}
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-brand grid place-items-center text-xs sm:text-sm font-semibold text-white shrink-0">
          {initials(profile?.name)}
        </div>
      </div>
    </header>
  );
}

