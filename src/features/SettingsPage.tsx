import { useState, useEffect } from "react";
import {
  Building2,
  CalendarCheck,
  MapPin,
  Wallet,
  CalendarDays,
  Megaphone,
  Calendar,
  Bell,
  ShieldCheck,
  History,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  UserCheck,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";
import {
  useSettings,
  type WeekdayKey,
  type HolidayItem,
  type AnnouncementItem,
  type EventItem,
} from "@/context/SettingsContext";
import { Modal } from "@/components/hrms/Modal";
import { Badge } from "@/components/hrms/Badge";
import { toast } from "sonner";

export function SettingsPage() {
  const { profile } = useAuth();
  const {
    settings,
    updateSettings,
    resetSettings,
    addHoliday,
    deleteHoliday,
    addAnnouncement,
    deleteAnnouncement,
    addEvent,
    deleteEvent,
  } = useSettings();

  const adminName = profile?.name || "Admin";

  const [activeTab, setActiveTab] = useState<
    | "general"
    | "attendance"
    | "wfh"
    | "payroll"
    | "holidays"
    | "announcements"
    | "events"
    | "notifications"
    | "leave_security"
    | "audit"
  >("general");

  // Local form states for dynamic editing
  const [genForm, setGenForm] = useState(settings.general);
  const [attForm, setAttForm] = useState(settings.attendance);
  const [geoForm, setGeoForm] = useState(settings.geo);
  const [payForm, setPayForm] = useState(settings.payroll);
  const [notifForm, setNotifForm] = useState(settings.notifications);
  const [leaveForm, setLeaveForm] = useState(settings.leave);
  const [empForm, setEmpForm] = useState(settings.employee);
  const [secForm, setSecForm] = useState(settings.security);

  useEffect(() => {
    setGenForm(settings.general);
    setAttForm(settings.attendance);
    setGeoForm(settings.geo);
    setPayForm(settings.payroll);
    setNotifForm(settings.notifications);
    setLeaveForm(settings.leave);
    setEmpForm(settings.employee);
    setSecForm(settings.security);
  }, [settings]);

  // Modals for adding Holidays, Announcements, Events
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState<Omit<HolidayItem, "id">>({
    name: "",
    date: new Date().toISOString().slice(0, 10),
    type: "Company Holiday",
    color: "#3B82F6",
  });

  const [showAnnModal, setShowAnnModal] = useState(false);
  const [newAnn, setNewAnn] = useState<Omit<AnnouncementItem, "id" | "createdAt">>({
    title: "",
    description: "",
    priority: "Normal",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    departments: ["All"],
    published: true,
  });

  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState<Omit<EventItem, "id">>({
    title: "",
    type: "Office Event",
    date: new Date().toISOString().slice(0, 10),
    time: "10:00 AM",
    description: "",
    color: "#8B5CF6",
  });

  const handleSaveGeneral = () => {
    updateSettings({ general: genForm }, "General Settings", adminName);
    toast.success("General settings saved successfully!");
  };

  const handleSaveAttendance = () => {
    updateSettings({ attendance: attForm }, "Attendance Settings", adminName);
    toast.success("Attendance settings saved successfully!");
  };

  const handleSaveGeo = async () => {
    updateSettings({ geo: geoForm }, "WFH & Geo Location Settings", adminName);

    try {
      const gpsState = geoForm.enableGpsRestriction;
      await supabase.from("employees").update({ gps_enabled: gpsState }).neq("id", "00000000-0000-0000-0000-000000000000");
      await supabaseAdmin.from("employees").update({ gps_enabled: gpsState }).neq("id", "00000000-0000-0000-0000-000000000000");
    } catch (e) {
      console.warn("Could not bulk update employee gps_enabled column:", e);
    }

    if (!geoForm.enableGpsRestriction) {
      toast.success("GPS Restriction turned OFF globally! All employees can now punch in without location.");
    } else {
      toast.success("GPS Restriction turned ON! Employees require live location for punch-in.");
    }
  };

  const handleSavePayroll = () => {
    updateSettings({ payroll: payForm }, "Payroll Settings", adminName);
    toast.success("Payroll settings saved successfully!");
  };

  const handleSaveNotifications = () => {
    updateSettings({ notifications: notifForm }, "Notification Settings", adminName);
    toast.success("Notification settings saved successfully!");
  };

  const handleSaveLeaveSecurity = () => {
    updateSettings(
      { leave: leaveForm, employee: empForm, security: secForm },
      "Leave & Security Settings",
      adminName
    );
    toast.success("Leave & Security settings saved successfully!");
  };

  const handleAddHolidaySubmit = () => {
    if (!newHoliday.name.trim()) {
      toast.error("Please enter a holiday name");
      return;
    }
    addHoliday(newHoliday, adminName);
    setShowHolidayModal(false);
    setNewHoliday({
      name: "",
      date: new Date().toISOString().slice(0, 10),
      type: "Company Holiday",
      color: "#3B82F6",
    });
    toast.success("Holiday added to company calendar");
  };

  const handleAddAnnSubmit = async () => {
    if (!newAnn.title.trim()) {
      toast.error("Please enter announcement title");
      return;
    }
    try {
      await addAnnouncement(newAnn, adminName);
      setShowAnnModal(false);
      setNewAnn({
        title: "",
        description: "",
        priority: "Normal",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        departments: ["All"],
        published: true,
      });
      toast.success("Announcement published successfully");
    } catch (error) {
      console.error("Failed to publish announcement:", error);
      toast.error("Could not save the announcement to Supabase");
    }
  };

  const handleAddEventSubmit = async () => {
    if (!newEvent.title.trim()) {
      toast.error("Please enter event title");
      return;
    }
    try {
      await addEvent(newEvent, adminName);
      setShowEventModal(false);
      setNewEvent({
        title: "",
        type: "Office Event",
        date: new Date().toISOString().slice(0, 10),
        time: "10:00 AM",
        description: "",
        color: "#8B5CF6",
      });
      toast.success("Event created successfully");
    } catch (error) {
      console.error("Failed to create event:", error);
      toast.error("Could not save the event to Supabase");
    }
  };

  const weekdays: WeekdayKey[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Organization Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure system-wide rules for company profile, attendance, WFH geo-fencing, payroll, calendar, and security.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (confirm("Are you sure you want to reset all settings to system defaults?")) {
                resetSettings();
                toast.info("Settings reset to defaults");
                window.location.reload();
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
          >
            <RotateCcw className="h-4 w-4" /> Reset Defaults
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <nav className="flex space-x-6 min-w-max" aria-label="Tabs">
          {[
            { id: "general", label: "General", icon: Building2 },
            { id: "attendance", label: "Attendance & Hours", icon: CalendarCheck },
            { id: "wfh", label: "WFH & Geo-Location", icon: MapPin },
            { id: "payroll", label: "Payroll Rules", icon: Wallet },
            { id: "holidays", label: "Holidays & Weekdays", icon: CalendarDays },
            { id: "announcements", label: "Announcements", icon: Megaphone },
            { id: "events", label: "Events & Calendar", icon: Calendar },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "leave_security", label: "Leave & Security", icon: ShieldCheck },
            { id: "audit", label: "Audit Logs", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT: GENERAL SETTINGS */}
      {activeTab === "general" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Company & General Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Basic details displayed across payslips, emails, and reports.</p>
            </div>
            <button onClick={handleSaveGeneral} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Company Name</label>
              <input type="text" value={genForm.companyName} onChange={(e) => setGenForm({ ...genForm, companyName: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Company Logo Path / URL</label>
              <input type="text" value={genForm.logoUrl} onChange={(e) => setGenForm({ ...genForm, logoUrl: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Office Address</label>
              <textarea rows={2} value={genForm.address} onChange={(e) => setGenForm({ ...genForm, address: e.target.value })} className="input-field resize-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">HR Email</label>
              <input type="email" value={genForm.email} onChange={(e) => setGenForm({ ...genForm, email: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Phone Number</label>
              <input type="text" value={genForm.phone} onChange={(e) => setGenForm({ ...genForm, phone: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Website</label>
              <input type="text" value={genForm.website} onChange={(e) => setGenForm({ ...genForm, website: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Time Zone</label>
              <select value={genForm.timeZone} onChange={(e) => setGenForm({ ...genForm, timeZone: e.target.value })} className="input-field">
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Currency Symbol</label>
              <input type="text" value={genForm.currency} onChange={(e) => setGenForm({ ...genForm, currency: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Payroll Cycle Rule</label>
              <input type="text" value={genForm.payrollCycle} onChange={(e) => setGenForm({ ...genForm, payrollCycle: e.target.value })} className="input-field" />
              <p className="text-[11px] text-slate-400">Standard: 27th Previous Month to 26th Current Month</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ATTENDANCE & WORKING HOURS */}
      {activeTab === "attendance" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Attendance & Working Hours Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Configure daily work shifts, late mark thresholds, and grace time.</p>
            </div>
            <button onClick={handleSaveAttendance} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Office Start Time</label>
              <input type="time" value={attForm.startTime} onChange={(e) => setAttForm({ ...attForm, startTime: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Office End Time</label>
              <input type="time" value={attForm.endTime} onChange={(e) => setAttForm({ ...attForm, endTime: e.target.value })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Late Arrival Mark Threshold</label>
              <input type="time" value={attForm.lateThreshold} onChange={(e) => setAttForm({ ...attForm, lateThreshold: e.target.value })} className="input-field" />
              <p className="text-[11px] text-slate-400">Arrivals after this time are marked Late</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Checkout Max Time Limit</label>
              <input type="time" value={attForm.checkoutMaxTime} onChange={(e) => setAttForm({ ...attForm, checkoutMaxTime: e.target.value })} className="input-field" />
              <p className="text-[11px] text-slate-400">Checkouts allowed up to this time (e.g. 18:30)</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Grace Time (Minutes)</label>
              <input type="number" min={0} value={attForm.graceMinutes} onChange={(e) => setAttForm({ ...attForm, graceMinutes: Number(e.target.value) })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Half-Day Working Hours Threshold</label>
              <input type="number" min={1} max={12} value={attForm.halfDayHours} onChange={(e) => setAttForm({ ...attForm, halfDayHours: Number(e.target.value) })} className="input-field" />
              <p className="text-[11px] text-slate-400">Less than this threshold counts as Half Day</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: WFH & GEO-LOCATION */}
      {activeTab === "wfh" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Work From Home & Geo-Location Policy</h2>
              <p className="text-xs text-slate-500 mt-0.5">Toggle office GPS geo-fence restriction for remote/work-from-home employees.</p>
            </div>
            <button onClick={handleSaveGeo} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900">Enable Office GPS Restriction</p>
                <Badge variant={geoForm.enableGpsRestriction ? "success" : "warning"}>
                  {geoForm.enableGpsRestriction ? "GPS RESTRICTED (ON)" : "WORK FROM HOME ALLOWED (OFF)"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                When ON, employees must be within office radius to check in. When OFF, employees can check in from anywhere (WFH).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={geoForm.enableGpsRestriction}
                onChange={(e) => setGeoForm({ ...geoForm, enableGpsRestriction: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Office Latitude</label>
              <input type="number" step="any" value={geoForm.officeLat} onChange={(e) => setGeoForm({ ...geoForm, officeLat: Number(e.target.value) })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Office Longitude</label>
              <input type="number" step="any" value={geoForm.officeLng} onChange={(e) => setGeoForm({ ...geoForm, officeLng: Number(e.target.value) })} className="input-field" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Allowed Radius (Meters)</label>
              <input type="number" min={10} max={10000} value={geoForm.allowedRadiusMeters} onChange={(e) => setGeoForm({ ...geoForm, allowedRadiusMeters: Number(e.target.value) })} className="input-field" />
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PAYROLL RULES */}
      {activeTab === "payroll" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Payroll Calculation Rules</h2>
              <p className="text-xs text-slate-500 mt-0.5">Set automatic deduction, overtime, and salary formula parameters.</p>
            </div>
            <button onClick={handleSavePayroll} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Salary Calculation Type</label>
              <select value={payForm.calculationType} onChange={(e) => setPayForm({ ...payForm, calculationType: e.target.value as any })} className="input-field">
                <option value="Working Days">Working Days (Excludes Weekends & Holidays)</option>
                <option value="Calendar Days">Total Calendar Days (30/31 Days)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Overtime Rate Multiplier</label>
              <input type="number" step="0.1" value={payForm.overtimeRate} onChange={(e) => setPayForm({ ...payForm, overtimeRate: Number(e.target.value) })} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            {[
              { key: "excludeWeekends", label: "Exclude Weekends from Required Days", desc: "Weekends will not deduct salary." },
              { key: "excludeHolidays", label: "Exclude Holidays from Required Days", desc: "Company holidays are paid days." },
              { key: "overtimeEnabled", label: "Enable Overtime Calculation", desc: "Calculate pay for extra hours worked." },
              { key: "lateDeduction", label: "Enable Late Arrival Deductions", desc: "Apply hourly deduction for unexcused late marks." },
              { key: "leaveDeduction", label: "Enable Unapproved Leave Deductions", desc: "Deduct salary for absent or unapproved leave days." },
              { key: "autoPayslips", label: "Automatic Payslip PDF Storage", desc: "Save payslip PDF records automatically during generation." },
            ].map((rule) => (
              <div key={rule.key} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">{rule.label}</p>
                  <p className="text-[11px] text-slate-500">{rule.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={(payForm as any)[rule.key]}
                  onChange={(e) => setPayForm({ ...payForm, [rule.key]: e.target.checked })}
                  className="h-4 w-4 text-brand rounded border-slate-300 focus:ring-brand"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: HOLIDAYS & WEEKDAYS */}
      {activeTab === "holidays" && (
        <div className="space-y-6">
          {/* Weekday Working Days Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Weekly Working Days Configuration</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle any weekday ON or OFF. Disabled days immediately become Weekends (Check-in disabled, excluded from payroll).
                </p>
              </div>
              <button onClick={handleSaveAttendance} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
                <Save className="h-4 w-4" /> Save Weekday Settings
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pt-2">
              {weekdays.map((day) => {
                const isWorking = attForm.workingDays[day];
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...attForm.workingDays,
                        [day]: !isWorking,
                      };
                      setAttForm({ ...attForm, workingDays: updated });
                    }}
                    className={`p-4 rounded-xl border text-center transition flex flex-col items-center gap-2 ${
                      isWorking
                        ? "bg-emerald-50/60 border-emerald-300 text-emerald-900"
                        : "bg-rose-50/60 border-rose-200 text-rose-800 opacity-70"
                    }`}
                  >
                    <span className="text-xs font-bold">{day}</span>
                    <Badge variant={isWorking ? "success" : "danger"}>
                      {isWorking ? "Working" : "Weekend"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Holiday List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Company Holidays Management</h2>
                <p className="text-xs text-slate-500 mt-0.5">Holidays automatically reflect in Admin & Employee calendars and payroll.</p>
              </div>
              <button onClick={() => setShowHolidayModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
                <Plus className="h-4 w-4" /> Add Holiday
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Holiday Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Date</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Category</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.holidays.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: h.color || "#3B82F6" }} />
                        {h.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{h.date}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info">{h.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteHoliday(h.id, adminName)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {settings.holidays.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-400">No holidays added yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ANNOUNCEMENTS */}
      {activeTab === "announcements" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Announcements Management</h2>
              <p className="text-xs text-slate-500 mt-0.5">Publish company-wide announcements for Employee & Admin Dashboards.</p>
            </div>
            <button onClick={() => setShowAnnModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Plus className="h-4 w-4" /> Publish Announcement
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.announcements.map((a) => (
              <div key={a.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <Badge variant={a.priority === "Critical" ? "danger" : a.priority === "Important" ? "warning" : "info"}>
                    {a.priority} Priority
                  </Badge>
                  <button onClick={() => deleteAnnouncement(a.id, adminName)} className="p-1 text-slate-400 hover:text-rose-600 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-3">{a.description}</p>
                <div className="flex items-center justify-between pt-2 border-t text-[11px] text-slate-400">
                  <span>Scope: {a.departments.join(", ")}</span>
                  <span>Active: {a.startDate} to {a.endDate}</span>
                </div>
              </div>
            ))}
            {settings.announcements.length === 0 && (
              <p className="text-sm text-slate-400 py-8 text-center col-span-2">No active announcements published</p>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: EVENTS & CALENDAR */}
      {activeTab === "events" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Events & Meetings Calendar Management</h2>
              <p className="text-xs text-slate-500 mt-0.5">Schedule meetings, trainings, birthdays, and company events.</p>
            </div>
            <button onClick={() => setShowEventModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Plus className="h-4 w-4" /> Add Event
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Event Title</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Event Type</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Date & Time</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.events.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: e.color || "#8B5CF6" }} />
                      {e.title}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="purple">{e.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.date} {e.time ? `at ${e.time}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteEvent(e.id, adminName)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {settings.events.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">No scheduled events found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Notification Channel Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enable or disable system alert triggers across modules.</p>
            </div>
            <button onClick={handleSaveNotifications} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "attendance", label: "Attendance & Check-in Alerts" },
              { key: "leave", label: "Leave Application & Approval Notifications" },
              { key: "payroll", label: "Payroll & Payslip Notifications" },
              { key: "announcement", label: "Announcement Alerts" },
              { key: "birthday", label: "Employee Birthday Alerts" },
              { key: "holiday", label: "Upcoming Holiday Alerts" },
              { key: "email", label: "Email Notifications Channel" },
              { key: "sms", label: "SMS Notifications Channel" },
            ].map((n) => (
              <div key={n.key} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{n.label}</span>
                <input
                  type="checkbox"
                  checked={(notifForm as any)[n.key]}
                  onChange={(e) => setNotifForm({ ...notifForm, [n.key]: e.target.checked })}
                  className="h-4 w-4 text-brand rounded border-slate-300 focus:ring-brand"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: LEAVE & SECURITY */}
      {activeTab === "leave_security" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Leave Limits & Security Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Configure annual leave quotas, self-service options, and session security.</p>
            </div>
            <button onClick={handleSaveLeaveSecurity} className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Leave Quotas & Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Max Casual Leave (Days/Year)</label>
                <input type="number" min={0} value={leaveForm.maxCasualLeave} onChange={(e) => setLeaveForm({ ...leaveForm, maxCasualLeave: Number(e.target.value) })} className="input-field" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Max Sick Leave (Days/Year)</label>
                <input type="number" min={0} value={leaveForm.maxSickLeave} onChange={(e) => setLeaveForm({ ...leaveForm, maxSickLeave: Number(e.target.value) })} className="input-field" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Max Earned Leave (Days/Year)</label>
                <input type="number" min={0} value={leaveForm.maxEarnedLeave} onChange={(e) => setLeaveForm({ ...leaveForm, maxEarnedLeave: Number(e.target.value) })} className="input-field" />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Security & Session Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Session Timeout (Minutes)</label>
                <input type="number" min={5} value={secForm.sessionTimeoutMinutes} onChange={(e) => setSecForm({ ...secForm, sessionTimeoutMinutes: Number(e.target.value) })} className="input-field" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Max Login Attempts Before Lockout</label>
                <input type="number" min={3} max={10} value={secForm.maxLoginAttempts} onChange={(e) => setSecForm({ ...secForm, maxLoginAttempts: Number(e.target.value) })} className="input-field" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Admin Audit Trail Logs</h2>
              <p className="text-xs text-slate-500 mt-0.5">Trace of setting modifications, additions, and administrative actions.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Timestamp</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Admin</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Section</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Action Description</th>
                </tr>
              </thead>
              <tbody>
                {settings.auditLogs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-medium">{log.adminName}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="info">{log.section}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD HOLIDAY */}
      <Modal open={showHolidayModal} title="Add Company Holiday" onClose={() => setShowHolidayModal(false)}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Holiday Name</label>
            <input type="text" value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} className="input-field" placeholder="e.g. Founder's Day" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Date</label>
              <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Category</label>
              <select value={newHoliday.type} onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value as any })} className="input-field">
                <option value="Government">Government</option>
                <option value="Festival">Festival</option>
                <option value="Company Holiday">Company Holiday</option>
                <option value="Optional Holiday">Optional Holiday</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowHolidayModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleAddHolidaySubmit} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition">Save Holiday</button>
        </div>
      </Modal>

      {/* MODAL: ADD ANNOUNCEMENT */}
      <Modal open={showAnnModal} title="Publish Announcement" onClose={() => setShowAnnModal(false)}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Title</label>
            <input type="text" value={newAnn.title} onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })} className="input-field" placeholder="Announcement title" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Description</label>
            <textarea rows={3} value={newAnn.description} onChange={(e) => setNewAnn({ ...newAnn, description: e.target.value })} className="input-field resize-none" placeholder="Announcement content..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Priority</label>
              <select value={newAnn.priority} onChange={(e) => setNewAnn({ ...newAnn, priority: e.target.value as any })} className="input-field">
                <option value="Normal">Normal</option>
                <option value="Important">Important</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">End Date</label>
              <input type="date" value={newAnn.endDate} onChange={(e) => setNewAnn({ ...newAnn, endDate: e.target.value })} className="input-field" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowAnnModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleAddAnnSubmit} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition">Publish</button>
        </div>
      </Modal>

      {/* MODAL: ADD EVENT */}
      <Modal open={showEventModal} title="Create Calendar Event" onClose={() => setShowEventModal(false)}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Event Title</label>
            <input type="text" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} className="input-field" placeholder="Event title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Event Type</label>
              <select value={newEvent.type} onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })} className="input-field">
                <option value="Meeting">Meeting</option>
                <option value="Training">Training</option>
                <option value="Office Event">Office Event</option>
                <option value="Birthday">Birthday</option>
                <option value="Company Event">Company Event</option>
                <option value="Festival">Festival</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Date</label>
              <input type="date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} className="input-field" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowEventModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleAddEventSubmit} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition">Create Event</button>
        </div>
      </Modal>
    </div>
  );
}
