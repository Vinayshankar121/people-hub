import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";

export type WeekdayKey = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export type GeneralSettings = {
  companyName: string;
  logoUrl: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  timeZone: string;
  currency: string;
  payrollCycle: string;
};

export type AttendanceSettings = {
  workingDays: Record<WeekdayKey, boolean>;
  startTime: string; // e.g. "09:00" or "09:30"
  endTime: string;   // e.g. "18:00" or "18:30"
  checkoutMaxTime: string; // e.g. "18:30"
  graceMinutes: number; // e.g. 15
  lateThreshold: string; // e.g. "09:15" or "10:00"
  halfDayHours: number; // e.g. 4
};

export type GeoSettings = {
  enableGpsRestriction: boolean;
  officeLat: number;
  officeLng: number;
  allowedRadiusMeters: number;
};

export type PayrollSettings = {
  calculationType: "Working Days" | "Calendar Days";
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  overtimeEnabled: boolean;
  overtimeRate: number; // multiplier e.g. 1.5
  lateDeduction: boolean;
  leaveDeduction: boolean;
  autoPayslips: boolean;
};

export type HolidayItem = {
  id: string;
  name: string;
  date: string; // ISO YYYY-MM-DD
  type: "Government" | "Festival" | "Company Holiday" | "Optional Holiday";
  color?: string;
};

export type AnnouncementItem = {
  id: string;
  calendarEventId?: string;
  title: string;
  description: string;
  priority: "Normal" | "Important" | "Critical";
  startDate: string;
  endDate: string;
  departments: string[]; // ["All"] or ["HR", "Accounts", etc.]
  published: boolean;
  createdAt: string;
};

export type EventItem = {
  id: string;
  calendarEventId?: string;
  title: string;
  type: "Meeting" | "Training" | "Office Event" | "Birthday" | "Company Event" | "Festival";
  date: string; // YYYY-MM-DD
  time?: string;
  description?: string;
  color?: string;
};

export type NotificationSettings = {
  attendance: boolean;
  leave: boolean;
  payroll: boolean;
  announcement: boolean;
  birthday: boolean;
  holiday: boolean;
  email: boolean;
  sms: boolean;
};

export type LeaveSettings = {
  maxCasualLeave: number;
  maxSickLeave: number;
  maxEarnedLeave: number;
  carryForward: boolean;
  autoApproval: boolean;
  halfDayAllowed: boolean;
};

export type EmployeeSettings = {
  selfCheckIn: boolean;
  selfCheckOut: boolean;
  breakPunch: boolean;
  overtimePunch: boolean;
  correctionRequest: boolean;
  locationTracking: boolean;
  faceVerification: boolean;
};

export type SecuritySettings = {
  sessionTimeoutMinutes: number;
  passwordExpiryDays: number;
  loginOtp: boolean;
  deviceRestriction: boolean;
  maxLoginAttempts: number;
};

export type AuditLogItem = {
  id: string;
  timestamp: string;
  adminName: string;
  section: string;
  action: string;
};

export type OrganizationSettings = {
  general: GeneralSettings;
  attendance: AttendanceSettings;
  geo: GeoSettings;
  payroll: PayrollSettings;
  holidays: HolidayItem[];
  announcements: AnnouncementItem[];
  events: EventItem[];
  notifications: NotificationSettings;
  leave: LeaveSettings;
  employee: EmployeeSettings;
  security: SecuritySettings;
  auditLogs: AuditLogItem[];
};

const DEFAULT_SETTINGS: OrganizationSettings = {
  general: {
    companyName: "Tech Minds IT Solutions",
    logoUrl: "/logo.jpg",
    address: "Tech Minds Towers, Nellore, Andhra Pradesh",
    email: "hr@techminds.com",
    phone: "+91 98765 43210",
    website: "https://techminds.com",
    timeZone: "Asia/Kolkata",
    currency: "INR (₹)",
    payrollCycle: "27th to 26th",
  },
  attendance: {
    workingDays: {
      Monday: true,
      Tuesday: true,
      Wednesday: true,
      Thursday: true,
      Friday: true,
      Saturday: true, // Default Saturday enabled
      Sunday: false,  // Sunday default Weekend
    },
    startTime: "09:00",
    endTime: "18:00",
    checkoutMaxTime: "18:30",
    graceMinutes: 15,
    lateThreshold: "09:15",
    halfDayHours: 4,
  },
  geo: {
    enableGpsRestriction: true,
    officeLat: 14.450900836380491,
    officeLng: 79.98846669999999,
    allowedRadiusMeters: 100,
  },
  payroll: {
    calculationType: "Working Days",
    excludeWeekends: true,
    excludeHolidays: true,
    overtimeEnabled: true,
    overtimeRate: 1.5,
    lateDeduction: true,
    leaveDeduction: true,
    autoPayslips: true,
  },
  holidays: [
    { id: "h1", name: "New Year's Day", date: "2026-01-01", type: "Government", color: "#3B82F6" },
    { id: "h2", name: "Republic Day", date: "2026-01-26", type: "Government", color: "#3B82F6" },
    { id: "h3", name: "May Day", date: "2026-05-01", type: "Company Holiday", color: "#10B981" },
    { id: "h4", name: "Independence Day", date: "2026-08-15", type: "Government", color: "#3B82F6" },
    { id: "h5", name: "Gandhi Jayanti", date: "2026-10-02", type: "Government", color: "#3B82F6" },
    { id: "h6", name: "Diwali", date: "2026-11-08", type: "Festival", color: "#F59E0B" },
  ],
  announcements: [],
  events: [],
  notifications: {
    attendance: true,
    leave: true,
    payroll: true,
    announcement: true,
    birthday: true,
    holiday: true,
    email: true,
    sms: false,
  },
  leave: {
    maxCasualLeave: 12,
    maxSickLeave: 12,
    maxEarnedLeave: 15,
    carryForward: true,
    autoApproval: false,
    halfDayAllowed: true,
  },
  employee: {
    selfCheckIn: true,
    selfCheckOut: true,
    breakPunch: false,
    overtimePunch: true,
    correctionRequest: true,
    locationTracking: true,
    faceVerification: false,
  },
  security: {
    sessionTimeoutMinutes: 30,
    passwordExpiryDays: 90,
    loginOtp: false,
    deviceRestriction: false,
    maxLoginAttempts: 5,
  },
  auditLogs: [
    {
      id: "log-init",
      timestamp: new Date().toISOString(),
      adminName: "System Admin",
      section: "System",
      action: "Organization Settings engine initialized",
    },
  ],
};

type SettingsContextType = {
  settings: OrganizationSettings;
  updateSettings: (newSettings: Partial<OrganizationSettings>, sectionName?: string, adminName?: string) => void;
  resetSettings: () => void;
  addHoliday: (holiday: Omit<HolidayItem, "id">, adminName?: string) => void;
  deleteHoliday: (id: string, adminName?: string) => void;
  addAnnouncement: (announcement: Omit<AnnouncementItem, "id" | "createdAt" | "calendarEventId">, adminName?: string) => Promise<void>;
  deleteAnnouncement: (id: string, adminName?: string) => Promise<void>;
  addEvent: (event: Omit<EventItem, "id" | "calendarEventId">, adminName?: string) => Promise<void>;
  deleteEvent: (id: string, adminName?: string) => Promise<void>;
  isWorkingDay: (dateISO: string) => boolean;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

function mergeWithDefaultSettings(
  savedSettings: Partial<OrganizationSettings>,
): OrganizationSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    general: { ...DEFAULT_SETTINGS.general, ...(savedSettings.general || {}) },
    attendance: {
      ...DEFAULT_SETTINGS.attendance,
      ...(savedSettings.attendance || {}),
      workingDays: {
        ...DEFAULT_SETTINGS.attendance.workingDays,
        ...(savedSettings.attendance?.workingDays || {}),
      },
    },
    geo: { ...DEFAULT_SETTINGS.geo, ...(savedSettings.geo || {}) },
    payroll: { ...DEFAULT_SETTINGS.payroll, ...(savedSettings.payroll || {}) },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(savedSettings.notifications || {}),
    },
    leave: { ...DEFAULT_SETTINGS.leave, ...(savedSettings.leave || {}) },
    employee: { ...DEFAULT_SETTINGS.employee, ...(savedSettings.employee || {}) },
    security: { ...DEFAULT_SETTINGS.security, ...(savedSettings.security || {}) },
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] =
    useState<OrganizationSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef<OrganizationSettings>(DEFAULT_SETTINGS);

  // Fetch settings from Supabase on mount
  useEffect(() => {
    const fetchBackendSettings = async () => {
      try {
        const [settingsResult, eventsResult] = await Promise.all([
          supabase
            .from("company_settings")
            .select("settings_json")
            .eq("id", "default")
            .maybeSingle(),
          supabase
            .from("calendar_events")
            .select("*")
            .order("start_date", { ascending: true }),
        ]);
        const { data, error } = settingsResult;

        if (error) {
          console.error("Failed to load settings from Supabase:", error);
          return;
        }
        if (eventsResult.error) {
          console.error("Failed to load events from Supabase:", eventsResult.error);
        }

        const calendarRows = eventsResult.data ?? [];
        const announcements: AnnouncementItem[] = calendarRows
          .filter((row) => row.event_type === "announcement")
          .map((row) => ({
            id: `a-${row.id}`,
            calendarEventId: String(row.id),
            title: row.title,
            description: row.description || "",
            priority: "Normal",
            startDate: row.start_date,
            endDate: row.end_date,
            departments: ["All"],
            published: true,
            createdAt: row.created_at,
          }));
        const events: EventItem[] = calendarRows
          .filter((row) => row.event_type !== "announcement")
          .map((row) => ({
            id: `e-${row.id}`,
            calendarEventId: String(row.id),
            title: row.title,
            type:
              row.event_type === "meeting"
                ? "Meeting"
                : row.event_type === "training"
                  ? "Training"
                  : "Company Event",
            date: row.start_date,
            time: row.start_time || undefined,
            description: row.description || "",
            color: "#8B5CF6",
          }));
        const loadedSettings = {
          ...mergeWithDefaultSettings(
            (data?.settings_json || {}) as Partial<OrganizationSettings>,
          ),
          announcements,
          events,
        };
        settingsRef.current = loadedSettings;
        setSettings(loadedSettings);
      } catch (err) {
        console.error("Error fetching settings from backend:", err);
      }
    };

    fetchBackendSettings();
  }, []);

  const saveToBackend = async (newSettings: OrganizationSettings) => {
    try {
      // Calendar events and announcements live in public.calendar_events.
      // Do not duplicate them inside company_settings.settings_json.
      const settingsPayload = {
        ...newSettings,
        announcements: [],
        events: [],
      };
      const { error } = await supabase.from("company_settings").upsert(
        {
          id: "default",
          settings_json: settingsPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) {
        const { error: adminError } = await supabaseAdmin.from("company_settings").upsert(
          {
            id: "default",
            settings_json: settingsPayload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (adminError) throw adminError;
      }
    } catch (e) {
      console.error("Failed to save settings to Supabase backend:", e);
      throw e;
    }
  };

  const createCalendarEvent = async ({
    title,
    description = "",
    startDate,
    endDate,
    startTime,
    eventType,
    visibility = "all",
  }: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    eventType: "company" | "meeting" | "training" | "announcement";
    visibility?: "all" | "department";
  }) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw userError || new Error("You must be signed in to create calendar events.");
    }

    const payload = {
      title,
      description,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime || null,
      end_time: null,
      event_type: eventType,
      location: null,
      created_by: userData.user.id,
      visibility,
    };

    let { data, error } = await supabase
      .from("calendar_events")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      const adminResult = await supabaseAdmin
        .from("calendar_events")
        .insert(payload)
        .select("id")
        .single();
      data = adminResult.data;
      error = adminResult.error;
    }

    if (error || !data?.id) {
      throw error || new Error("Supabase did not return the new calendar event.");
    }

    return String(data.id);
  };

  const addAuditLog = (adminName: string, section: string, action: string, currentLogs: AuditLogItem[]) => {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      adminName: adminName || "Admin",
      section,
      action,
    };
    return [newLog, ...currentLogs].slice(0, 100);
  };

  const updateSettings = useCallback((newSettings: Partial<OrganizationSettings>, sectionName = "General", adminName = "Admin") => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      const updatedLogs = addAuditLog(adminName, sectionName, `Updated ${sectionName} settings`, prev.auditLogs);
      const finalState = { ...updated, auditLogs: updatedLogs };
      settingsRef.current = finalState;
      saveToBackend(finalState);
      return finalState;
    });
  }, []);

  const resetSettings = useCallback(() => {
    settingsRef.current = DEFAULT_SETTINGS;
    setSettings(DEFAULT_SETTINGS);
    saveToBackend(DEFAULT_SETTINGS);
  }, []);

  const addHoliday = useCallback((holiday: Omit<HolidayItem, "id">, adminName = "Admin") => {
    setSettings((prev) => {
      const newItem: HolidayItem = { ...holiday, id: `h-${Date.now()}` };
      const holidays = [...prev.holidays, newItem];
      const auditLogs = addAuditLog(adminName, "Holidays", `Added holiday "${holiday.name}" on ${holiday.date}`, prev.auditLogs);
      const finalState = { ...prev, holidays, auditLogs };
      settingsRef.current = finalState;
      saveToBackend(finalState);
      return finalState;
    });

    supabase.from("holidays").insert({ name: holiday.name, date: holiday.date, type: holiday.type || "Company Holiday" })
      .then(({ error }) => {
        if (error) {
          supabaseAdmin.from("holidays").insert({ name: holiday.name, date: holiday.date, type: holiday.type || "Company Holiday" });
        }
      });
  }, []);

  const deleteHoliday = useCallback((id: string, adminName = "Admin") => {
    setSettings((prev) => {
      const holiday = prev.holidays.find((h) => h.id === id);
      const holidays = prev.holidays.filter((h) => h.id !== id);
      const auditLogs = addAuditLog(adminName, "Holidays", `Removed holiday "${holiday?.name || id}"`, prev.auditLogs);
      const finalState = { ...prev, holidays, auditLogs };
      settingsRef.current = finalState;
      saveToBackend(finalState);
      return finalState;
    });
  }, []);

  const addAnnouncement = useCallback(async (announcement: Omit<AnnouncementItem, "id" | "createdAt" | "calendarEventId">, adminName = "Admin") => {
    const calendarEventId = await createCalendarEvent({
      title: announcement.title,
      description: announcement.description,
      startDate: announcement.startDate,
      endDate: announcement.endDate,
      eventType: "announcement",
      visibility: announcement.departments.includes("All") ? "all" : "department",
    });
    const prev = settingsRef.current;
    const newItem: AnnouncementItem = {
      ...announcement,
      id: `a-${Date.now()}`,
      calendarEventId,
      createdAt: new Date().toISOString(),
    };
    const finalState = {
      ...prev,
      announcements: [newItem, ...prev.announcements],
      auditLogs: addAuditLog(adminName, "Announcements", `Published announcement "${announcement.title}"`, prev.auditLogs),
    };
    await saveToBackend(finalState);
    settingsRef.current = finalState;
    setSettings(finalState);
  }, []);

  const deleteAnnouncement = useCallback(async (id: string, adminName = "Admin") => {
    const prev = settingsRef.current;
    const item = prev.announcements.find((a) => a.id === id);
    if (item?.calendarEventId) {
      const { error } = await supabase.from("calendar_events").delete().eq("id", item.calendarEventId);
      if (error) throw error;
    }
    const finalState = {
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== id),
      auditLogs: addAuditLog(adminName, "Announcements", `Deleted announcement "${item?.title || id}"`, prev.auditLogs),
    };
    await saveToBackend(finalState);
    settingsRef.current = finalState;
    setSettings(finalState);
  }, []);

  const addEvent = useCallback(async (event: Omit<EventItem, "id" | "calendarEventId">, adminName = "Admin") => {
    const calendarEventId = await createCalendarEvent({
      title: event.title,
      description: event.description,
      startDate: event.date,
      endDate: event.date,
      startTime: event.time,
      eventType:
        event.type === "Meeting"
          ? "meeting"
          : event.type === "Training"
            ? "training"
            : "company",
    });
    const prev = settingsRef.current;
    const newItem: EventItem = { ...event, id: `e-${Date.now()}`, calendarEventId };
    const finalState = {
      ...prev,
      events: [...prev.events, newItem],
      auditLogs: addAuditLog(adminName, "Events", `Created event "${event.title}" on ${event.date}`, prev.auditLogs),
    };
    await saveToBackend(finalState);
    settingsRef.current = finalState;
    setSettings(finalState);
  }, []);

  const deleteEvent = useCallback(async (id: string, adminName = "Admin") => {
    const prev = settingsRef.current;
    const item = prev.events.find((e) => e.id === id);
    if (item?.calendarEventId) {
      const { error } = await supabase.from("calendar_events").delete().eq("id", item.calendarEventId);
      if (error) throw error;
    }
    const finalState = {
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
      auditLogs: addAuditLog(adminName, "Events", `Removed event "${item?.title || id}"`, prev.auditLogs),
    };
    await saveToBackend(finalState);
    settingsRef.current = finalState;
    setSettings(finalState);
  }, []);

  const isWorkingDay = useCallback(
    (dateISO: string): boolean => {
      const d = new Date(dateISO + "T00:00:00");
      const dayIndex = d.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
      const daysMap: WeekdayKey[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = daysMap[dayIndex];

      // Check if weekday is enabled in settings
      const isDayEnabled = !!settings.attendance.workingDays[dayName];
      if (!isDayEnabled) return false;

      // Check if date is a company holiday
      const isHolidayDate = settings.holidays.some((h) => h.date === dateISO && h.type !== "Optional Holiday");
      if (isHolidayDate) return false;

      return true;
    },
    [settings]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        addHoliday,
        deleteHoliday,
        addAnnouncement,
        deleteAnnouncement,
        addEvent,
        deleteEvent,
        isWorkingDay,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
