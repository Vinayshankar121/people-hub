import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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
  lateThreshold: string; // e.g. "09:15"
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
      Saturday: true, // Default Saturday enabled as per previous implementation
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
  announcements: [
    {
      id: "a1",
      title: "Quarterly All-Hands Meeting",
      description: "Join us for our Q3 review and team achievements celebration in the main hall.",
      priority: "Important",
      startDate: "2026-07-01",
      endDate: "2026-08-31",
      departments: ["All"],
      published: true,
      createdAt: new Date().toISOString(),
    },
  ],
  events: [
    { id: "e1", title: "Monthly Tech Demo", type: "Meeting", date: "2026-07-28", time: "11:00 AM", color: "#8B5CF6" },
    { id: "e2", title: "Security Awareness Training", type: "Training", date: "2026-07-30", time: "02:00 PM", color: "#EC4899" },
  ],
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

const STORAGE_KEY = "hrms_org_settings_v1";

type SettingsContextType = {
  settings: OrganizationSettings;
  updateSettings: (newSettings: Partial<OrganizationSettings>, sectionName?: string, adminName?: string) => void;
  resetSettings: () => void;
  addHoliday: (holiday: Omit<HolidayItem, "id">, adminName?: string) => void;
  deleteHoliday: (id: string, adminName?: string) => void;
  addAnnouncement: (announcement: Omit<AnnouncementItem, "id" | "createdAt">, adminName?: string) => void;
  deleteAnnouncement: (id: string, adminName?: string) => void;
  addEvent: (event: Omit<EventItem, "id">, adminName?: string) => void;
  deleteEvent: (id: string, adminName?: string) => void;
  isWorkingDay: (dateISO: string) => boolean;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OrganizationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          general: { ...DEFAULT_SETTINGS.general, ...(parsed.general || {}) },
          attendance: {
            ...DEFAULT_SETTINGS.attendance,
            ...(parsed.attendance || {}),
            workingDays: { ...DEFAULT_SETTINGS.attendance.workingDays, ...(parsed.attendance?.workingDays || {}) },
          },
          geo: { ...DEFAULT_SETTINGS.geo, ...(parsed.geo || {}) },
          payroll: { ...DEFAULT_SETTINGS.payroll, ...(parsed.payroll || {}) },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
          leave: { ...DEFAULT_SETTINGS.leave, ...(parsed.leave || {}) },
          employee: { ...DEFAULT_SETTINGS.employee, ...(parsed.employee || {}) },
          security: { ...DEFAULT_SETTINGS.security, ...(parsed.security || {}) },
        };
      }
    } catch (e) {
      console.error("Failed to load saved organization settings:", e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save organization settings to localStorage:", e);
    }
  }, [settings]);

  const addAuditLog = (adminName: string, section: string, action: string, currentLogs: AuditLogItem[]) => {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      adminName: adminName || "Admin",
      section,
      action,
    };
    return [newLog, ...currentLogs].slice(0, 100); // Keep latest 100 logs
  };

  const updateSettings = useCallback((newSettings: Partial<OrganizationSettings>, sectionName = "General", adminName = "Admin") => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      const updatedLogs = addAuditLog(adminName, sectionName, `Updated ${sectionName} settings`, prev.auditLogs);
      return { ...updated, auditLogs: updatedLogs };
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }, []);

  const addHoliday = useCallback((holiday: Omit<HolidayItem, "id">, adminName = "Admin") => {
    setSettings((prev) => {
      const newItem: HolidayItem = { ...holiday, id: `h-${Date.now()}` };
      const holidays = [...prev.holidays, newItem];
      const auditLogs = addAuditLog(adminName, "Holidays", `Added holiday "${holiday.name}" on ${holiday.date}`, prev.auditLogs);
      return { ...prev, holidays, auditLogs };
    });
  }, []);

  const deleteHoliday = useCallback((id: string, adminName = "Admin") => {
    setSettings((prev) => {
      const holiday = prev.holidays.find((h) => h.id === id);
      const holidays = prev.holidays.filter((h) => h.id !== id);
      const auditLogs = addAuditLog(adminName, "Holidays", `Removed holiday "${holiday?.name || id}"`, prev.auditLogs);
      return { ...prev, holidays, auditLogs };
    });
  }, []);

  const addAnnouncement = useCallback((announcement: Omit<AnnouncementItem, "id" | "createdAt">, adminName = "Admin") => {
    setSettings((prev) => {
      const newItem: AnnouncementItem = {
        ...announcement,
        id: `a-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const announcements = [newItem, ...prev.announcements];
      const auditLogs = addAuditLog(adminName, "Announcements", `Published announcement "${announcement.title}"`, prev.auditLogs);
      return { ...prev, announcements, auditLogs };
    });
  }, []);

  const deleteAnnouncement = useCallback((id: string, adminName = "Admin") => {
    setSettings((prev) => {
      const item = prev.announcements.find((a) => a.id === id);
      const announcements = prev.announcements.filter((a) => a.id !== id);
      const auditLogs = addAuditLog(adminName, "Announcements", `Deleted announcement "${item?.title || id}"`, prev.auditLogs);
      return { ...prev, announcements, auditLogs };
    });
  }, []);

  const addEvent = useCallback((event: Omit<EventItem, "id">, adminName = "Admin") => {
    setSettings((prev) => {
      const newItem: EventItem = { ...event, id: `e-${Date.now()}` };
      const events = [...prev.events, newItem];
      const auditLogs = addAuditLog(adminName, "Events", `Created event "${event.title}" on ${event.date}`, prev.auditLogs);
      return { ...prev, events, auditLogs };
    });
  }, []);

  const deleteEvent = useCallback((id: string, adminName = "Admin") => {
    setSettings((prev) => {
      const item = prev.events.find((e) => e.id === id);
      const events = prev.events.filter((e) => e.id !== id);
      const auditLogs = addAuditLog(adminName, "Events", `Removed event "${item?.title || id}"`, prev.auditLogs);
      return { ...prev, events, auditLogs };
    });
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
