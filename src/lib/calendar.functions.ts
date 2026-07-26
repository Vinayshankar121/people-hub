/**
 * Calendar Management Admin Functions
 * Handles calendar config, holiday management, and calendar-payroll integration
 */

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.admin";
import { calculateWorkingDays, getHolidaysInRange } from "@/lib/calendar-system";

const updateCalendarConfigSchema = z.object({
  weekend_days: z.array(z.string()).optional(),
  max_paid_leaves_per_month: z.number().min(0).max(10).optional(),
  total_paid_leaves_per_year: z.number().min(0).max(50).optional(),
  enable_pf: z.boolean().optional(),
  enable_esi: z.boolean().optional(),
});

const generateCalendarSchema = z.object({
  year: z.number().int().min(2020).max(2030),
});

function isAdminOrCeoRole(role?: string): boolean {
  return role === "Admin" || role === "CEO";
}


const bulkImportHolidaysSchema = z.object({
  holidays: z.array(
    z.object({
      date: z.string(),
      name: z.string(),
      category: z.enum(["National", "Public", "Company", "Optional"]),
      description: z.string().optional(),
    })
  ),
});

/**
 * Update calendar configuration
 */
export async function updateCalendarConfig({
  data: raw,
}: {
  data: z.input<typeof updateCalendarConfigSchema>;
}) {
  const payload = updateCalendarConfigSchema.parse(raw);
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user?.id) throw new Error("Unauthorized");

  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("auth_uid", session.user.id)
    .single();

  if (!isAdminOrCeoRole(emp?.role)) throw new Error("Admin or CEO only");

  const { error, data: updated } = await supabaseAdmin
    .from("calendar_config")
    .update(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return { success: true, config: updated };
}

/**
 * Generate yearly calendar with weekends automatically marked
 */
export async function generateYearlyCalendar({
  data: raw,
}: {
  data: z.input<typeof generateCalendarSchema>;
}) {
  const { year } = generateCalendarSchema.parse(raw);
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user?.id) throw new Error("Unauthorized");

  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("auth_uid", session.user.id)
    .single();

  if (!isAdminOrCeoRole(emp?.role)) throw new Error("Admin or CEO only");

  // Get calendar config
  const { data: config } = await supabaseAdmin
    .from("calendar_config")
    .select("weekend_days")
    .single();

  if (!config) throw new Error("Calendar config not found");

  const weekendDays = config.weekend_days || ["Saturday", "Sunday"];
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const holidaysToInsert = [];
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year + 1, 0, 0));

  // Generate all weekends for the year
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayName = daysOfWeek[d.getUTCDay()];

    if (weekendDays.includes(dayName)) {
      const dateStr = d.toISOString().slice(0, 10);

      holidaysToInsert.push({
        date: dateStr,
        name: `${dayName}`,
        category: "Weekend",
        description: `Weekly ${dayName}`,
        is_full_day: true,
        is_optional: false,
        type: "Weekend", // Legacy field
      });
    }
  }

  // Delete existing weekend entries for this year
  await supabaseAdmin
    .from("holidays")
    .delete()
    .eq("category", "Weekend")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`);

  // Insert new weekend holidays
  if (holidaysToInsert.length > 0) {
    const { error } = await supabaseAdmin
      .from("holidays")
      .insert(holidaysToInsert);

    if (error) throw new Error(`Failed to generate calendar: ${error.message}`);
  }

  return {
    success: true,
    message: `Generated yearly calendar for ${year}`,
    weekendCount: holidaysToInsert.length,
  };
}

/**
 * Bulk import holidays from array
 */
export async function bulkImportHolidays({
  data: raw,
}: {
  data: z.input<typeof bulkImportHolidaysSchema>;
}) {
  const payload = bulkImportHolidaysSchema.parse(raw);
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user?.id) throw new Error("Unauthorized");

  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("auth_uid", session.user.id)
    .single();

  if (!isAdminOrCeoRole(emp?.role)) throw new Error("Admin or CEO only");

  const formattedHolidays = payload.holidays.map((h) => ({
    date: h.date,
    name: h.name,
    category: h.category,
    description: h.description || "",
    is_full_day: true,
    is_optional: h.category === "Optional",
    type: h.category, // Legacy field
  }));

  const { error, data: inserted } = await supabaseAdmin
    .from("holidays")
    .insert(formattedHolidays)
    .select();

  if (error) throw new Error(`Import failed: ${error.message}`);

  return {
    success: true,
    message: `Imported ${(inserted ?? []).length} holidays`,
    count: (inserted ?? []).length,
  };
}

/**
 * Get calendar data for payroll calculation
 * Returns config and holidays needed for working day calculation
 */
export async function getCalendarDataForPayroll(month: number, year: number) {
  const startISO = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const endISO = endDate.toISOString().slice(0, 10);

  const { data: config } = await supabaseAdmin
    .from("calendar_config")
    .select("*")
    .single();

  const { data: holidays } = await supabaseAdmin
    .from("holidays")
    .select("*")
    .gte("date", startISO)
    .lte("date", endISO);

  return {
    config: config || {
      weekend_days: ["Saturday", "Sunday"],
      max_paid_leaves_per_month: 2,
      total_paid_leaves_per_year: 24,
      enable_pf: false,
      enable_esi: false,
    },
    holidays: holidays ?? [],
    startDate: startISO,
    endDate: endISO,
  };
}

/**
 * Calculate working days for a month using calendar config
 */
export async function calculateMonthlyWorkingDays(
  month: number,
  year: number
): Promise<{
  totalDays: number;
  weekendDays: number;
  holidayDays: number;
  workingDays: number;
}> {
  const { config, holidays, startDate, endDate } = await getCalendarDataForPayroll(
    month,
    year
  );

  const weekendDays = config.weekend_days || ["Saturday", "Sunday"];

  // Count weekend days
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  let weekendCount = 0;
  let totalDayCount = 0;

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T23:59:59Z");

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    totalDayCount++;
    const dayName = daysOfWeek[d.getUTCDay()];
    if (weekendDays.includes(dayName)) {
      weekendCount++;
    }
  }

  // Count non-weekend holidays
  const holidayDayCount = holidays.filter(
    (h) => h.category !== "Weekend"
  ).length;

  const workingDays = Math.max(
    1,
    totalDayCount - weekendCount - holidayDayCount
  );

  return {
    totalDays: totalDayCount,
    weekendDays: weekendCount,
    holidayDays: holidayDayCount,
    workingDays,
  };
}

/**
 * Send holiday notification to all employees
 */
export async function sendHolidayNotification(
  holidayId: string,
  title: string,
  message: string
) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user?.id) throw new Error("Unauthorized");

  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("auth_uid", session.user.id)
    .single();

  if (!isAdminOrCeoRole(emp?.role)) throw new Error("Admin or CEO only");

  // Get all employees
  const { data: employees } = await supabaseAdmin
    .from("employees")
    .select("auth_uid");

  if (!employees || employees.length === 0) {
    return { success: true, count: 0 };
  }

  // Create notifications for each employee
  const notifications = employees.map((e) => ({
    user_auth_uid: e.auth_uid,
    holiday_id: holidayId,
    title,
    message,
    type: "holiday",
  }));

  const { error, data: inserted } = await supabaseAdmin
    .from("calendar_notifications")
    .insert(notifications)
    .select();

  if (error) {
    // Silently fail if some duplicates exist
    if (!error.message.includes("duplicate")) {
      throw new Error(error.message);
    }
  }

  return {
    success: true,
    message: `Notified ${(inserted ?? []).length} employees`,
    count: (inserted ?? []).length,
  };
}
