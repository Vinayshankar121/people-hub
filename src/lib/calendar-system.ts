/**
/**
 * Professional HRMS Calendar Management System
 * Comprehensive calendar, holiday, and working day calculations
 * IT Company optimized (Saturday & Sunday weekends)
 */
export interface CalendarConfig {
  id: string;
  company_name: string;
  weekend_days: string[]; // e.g., ['Saturday', 'Sunday']
  financial_year_start: number; // 1-12
  max_paid_leaves_per_month: number;
  total_paid_leaves_per_year: number;
  enable_pf: boolean;
  enable_esi: boolean;
}

export interface CalendarConfig {
  id: string;
  company_name: string;
  weekend_days: string[]; // e.g., ['Saturday', 'Sunday']
  financial_year_start: number; // 1-12
  max_paid_leaves_per_month: number;
  total_paid_leaves_per_year: number;
  enable_pf: boolean;
  enable_esi: boolean;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  category: "National" | "Public" | "Company" | "Optional" | "Weekend";
  description: string;
  is_full_day: boolean;
  is_optional: boolean;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holiday?: Holiday;
  isToday: boolean;
  dayOfMonth: number;
  month: number;
  year: number;
}

export interface CalendarMonth {
  year: number;
  month: number;
  monthName: string;
  days: CalendarDay[];
  workingDays: number;
  weekendDays: number;
  holidayCount: number;
  totalDays: number;
}

export interface CalendarStatistics {
  year: number;
  totalWorkingDays: number;
  totalWeekends: number;
  totalHolidays: number;
  totalDays: number;
  paidLeavesPerMonth: number;
  totalPaidLeavesPerYear: number;
  financialYearStart: number;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Check if a date is a weekend based on config
 */
export function isWeekend(date: string, weekendDays: string[]): boolean {
  const d = new Date(date + "T00:00:00Z");
  const dayName = DAYS_OF_WEEK[d.getUTCDay()];
  return dayName === "Sunday";
}

/**
 * Check if a date is a holiday
 */
export function isHolidayDate(date: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.date === date && h.category !== "Optional");
}

/**
 * Get holiday on a specific date
 */
export function getHolidayOnDate(date: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => h.date === date);
}

/**
 * Generate calendar day with all metadata
 */
export function createCalendarDay(
  dateStr: string,
  weekendDays: string[],
  holidays: Holiday[],
  today: string
): CalendarDay {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay();
  const dayName = DAYS_OF_WEEK[dayOfWeek];
  const weekend = isWeekend(dateStr, weekendDays);
  const holiday = getHolidayOnDate(dateStr, holidays);

  return {
    date: dateStr,
    dayOfWeek,
    dayName,
    isWeekend: weekend,
    isHoliday: !!holiday,
    holiday: holiday,
    isToday: dateStr === today,
    dayOfMonth: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

/**
 * Generate full calendar month
 */
export function generateCalendarMonth(
  year: number,
  month: number,
  weekendDays: string[],
  holidays: Holiday[]
): CalendarMonth {
  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  const today = new Date().toISOString().slice(0, 10);

  const days: CalendarDay[] = [];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push(createCalendarDay(dateStr, weekendDays, holidays, today));
  }

  const workingDays = days.filter((d) => !d.isWeekend && !d.isHoliday).length;
  const weekendDaysCount = days.filter((d) => d.isWeekend && !d.isHoliday).length;
  const holidayCount = days.filter((d) => d.isHoliday).length;

  return {
    year,
    month,
    monthName: MONTHS[month - 1],
    days,
    workingDays,
    weekendDays: weekendDaysCount,
    holidayCount,
    totalDays: days.length,
  };
}

/**
 * Generate full year calendar
 */
export function generateYearCalendar(
  year: number,
  weekendDays: string[],
  holidays: Holiday[]
): CalendarMonth[] {
  const months: CalendarMonth[] = [];

  for (let month = 1; month <= 12; month++) {
    months.push(generateCalendarMonth(year, month, weekendDays, holidays));
  }

  return months;
}

/**
 * Calculate working days between two dates
 */
export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  weekendDays: string[],
  holidays: Holiday[]
): number {
  let count = 0;
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    if (!isWeekend(dateStr, weekendDays) && !isHolidayDate(dateStr, holidays)) {
      count++;
    }
  }

  return count;
}

/**
 * Get all weekends in a date range
 */
export function getWeekendsInRange(
  startDate: string,
  endDate: string,
  weekendDays: string[]
): string[] {
  const weekends: string[] = [];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    if (isWeekend(dateStr, weekendDays)) {
      weekends.push(dateStr);
    }
  }

  return weekends;
}

/**
 * Get all holidays in a date range (excluding weekends)
 */
export function getHolidaysInRange(
  startDate: string,
  endDate: string,
  holidays: Holiday[]
): Holiday[] {
  return holidays.filter(
    (h) =>
      h.date >= startDate &&
      h.date <= endDate &&
      h.category !== "Optional" &&
      h.category !== "Weekend"
  );
}

/**
 * Calculate yearly calendar statistics
 */
export function calculateYearStatistics(
  year: number,
  weekendDays: string[],
  holidays: Holiday[],
  config: CalendarConfig
): CalendarStatistics {
  const months = generateYearCalendar(year, weekendDays, holidays);

  let totalWorkingDays = 0;
  let totalWeekends = 0;
  let totalHolidays = 0;

  for (const month of months) {
    totalWorkingDays += month.workingDays;
    totalWeekends += month.weekendDays;
    totalHolidays += month.holidayCount;
  }

  return {
    year,
    totalWorkingDays,
    totalWeekends,
    totalHolidays,
    totalDays: 365 + (isLeapYear(year) ? 1 : 0),
    paidLeavesPerMonth: config.max_paid_leaves_per_month,
    totalPaidLeavesPerYear: config.total_paid_leaves_per_year,
    financialYearStart: config.financial_year_start,
  };
}

/**
 * Check if a year is leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get financial year start and end dates
 */
export function getFinancialYear(
  calendarYear: number,
  financialYearStart: number
): { startDate: string; endDate: string; label: string } {
  if (financialYearStart > new Date().getMonth() + 1) {
    // Financial year hasn't started yet in current calendar year
    return {
      startDate: `${calendarYear - 1}-${String(financialYearStart).padStart(2, "0")}-01`,
      endDate: `${calendarYear}-${String((financialYearStart - 1) % 12 === 0 ? 12 : (financialYearStart - 1) % 12).padStart(2, "0")}-${
        new Date(calendarYear, financialYearStart, 0).getDate()
      }`,
      label: `FY ${calendarYear - 1}-${calendarYear}`,
    };
  } else {
    return {
      startDate: `${calendarYear}-${String(financialYearStart).padStart(2, "0")}-01`,
      endDate: `${calendarYear + 1}-${String((financialYearStart - 1) % 12 === 0 ? 12 : (financialYearStart - 1) % 12).padStart(2, "0")}-${
        new Date(calendarYear + 1, financialYearStart, 0).getDate()
      }`,
      label: `FY ${calendarYear}-${calendarYear + 1}`,
    };
  }
}

/**
 * Get upcoming holidays
 */
export function getUpcomingHolidays(holidays: Holiday[], daysAhead: number = 30): Holiday[] {
  const today = new Date().toISOString().slice(0, 10);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().slice(0, 10);

  return holidays
    .filter(
      (h) =>
        h.date >= today &&
        h.date <= futureDateStr &&
        h.category !== "Optional" &&
        h.category !== "Weekend"
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format date for display
 */
export function formatCalendarDate(dateStr: string, format: "short" | "long" = "short"): string {
  const d = new Date(dateStr + "T00:00:00Z");

  if (format === "short") {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } else {
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }
}

/**
 * Get week range for a date
 */
export function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day;

  const start = new Date(d.setUTCDate(diff));
  const end = new Date(d.setUTCDate(diff + 6));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/**
 * Get color based on holiday category
 */
export function getHolidayColor(category: string): string {
  const colors: Record<string, string> = {
    National: "#EF4444", // Red
    Public: "#F59E0B", // Amber
    Company: "#3B82F6", // Blue
    Optional: "#8B5CF6", // Purple
    Weekend: "#6B7280", // Gray
  };
  return colors[category] || "#6B7280";
}

/**
 * Get holiday category badge
 */
export function getHolidayBadge(category: string): { bg: string; text: string; icon: string } {
  const badges: Record<string, { bg: string; text: string; icon: string }> = {
    National: { bg: "bg-red-50", text: "text-red-700", icon: "🇮🇳" },
    Public: { bg: "bg-amber-50", text: "text-amber-700", icon: "🎉" },
    Company: { bg: "bg-blue-50", text: "text-blue-700", icon: "🏢" },
    Optional: { bg: "bg-purple-50", text: "text-purple-700", icon: "✨" },
    Weekend: { bg: "bg-gray-50", text: "text-gray-700", icon: "😴" },
  };
  return badges[category] || badges.Weekend;
}
