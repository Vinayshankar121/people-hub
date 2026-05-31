/**
 * IT Industry Holiday Calendar
 * Automatic holidays for IT/Tech companies
 * Includes National holidays observed in India + International celebrations
 */

export interface ITHoliday {
  name: string;
  date: string; // YYYY-MM-DD format
  type: "National" | "Company";
  description?: string;
}

/**
 * Get all IT industry holidays for the current year
 * Auto-generates holidays based on current year and fixed dates
 */
export function getITIndustryHolidays(year?: number): ITHoliday[] {
  const currentYear = year || new Date().getFullYear();

  return [
    // National Holidays - India
    { name: "Republic Day", date: `${currentYear}-01-26`, type: "National", description: "National holiday" },
    { name: "Holi", date: `${currentYear}-03-29`, type: "National", description: "Festival of colors" },
    { name: "Good Friday", date: `${currentYear}-04-18`, type: "National", description: "Christian holiday" },
    { name: "Eid ul-Fitr", date: `${currentYear}-03-30`, type: "National", description: "Islamic festival" },
    { name: "Eid ul-Adha", date: `${currentYear}-06-16`, type: "National", description: "Islamic festival" },
    { name: "Independence Day", date: `${currentYear}-08-15`, type: "National", description: "National holiday" },
    { name: "Janmashtami", date: `${currentYear}-08-26`, type: "National", description: "Hindu festival" },
    { name: "Ganesh Chaturthi", date: `${currentYear}-09-07`, type: "National", description: "Hindu festival" },
    { name: "Dussehra", date: `${currentYear}-10-02`, type: "National", description: "Hindu festival" },
    { name: "Diwali", date: `${currentYear}-11-01`, type: "National", description: "Festival of lights" },
    { name: "Guru Nanak Jayanti", date: `${currentYear}-11-15`, type: "National", description: "Sikh festival" },
    { name: "Christmas", date: `${currentYear}-12-25`, type: "National", description: "Christian holiday" },

    // Optional IT Company Holidays
    { name: "New Year Day", date: `${currentYear}-01-01`, type: "Company", description: "New Year celebration" },
    { name: "IT Day", date: `${currentYear}-12-11`, type: "Company", description: "National IT Day" },
  ];
}

/**
 * Get only national holidays
 */
export function getNationalHolidays(year?: number): ITHoliday[] {
  return getITIndustryHolidays(year).filter((h) => h.type === "National");
}

/**
 * Get only company-specific holidays
 */
export function getCompanyHolidays(year?: number): ITHoliday[] {
  return getITIndustryHolidays(year).filter((h) => h.type === "Company");
}

/**
 * Check if a date is a holiday
 */
export function isHoliday(date: string, holidays?: ITHoliday[]): boolean {
  const list = holidays || getITIndustryHolidays();
  return list.some((h) => h.date === date);
}

/**
 * Get holiday by date
 */
export function getHolidayByDate(date: string, holidays?: ITHoliday[]): ITHoliday | undefined {
  const list = holidays || getITIndustryHolidays();
  return list.find((h) => h.date === date);
}

/**
 * Get holidays for a date range
 */
export function getHolidaysInRange(startDate: string, endDate: string, year?: number): ITHoliday[] {
  const holidays = getITIndustryHolidays(year);
  return holidays.filter((h) => h.date >= startDate && h.date <= endDate);
}

/**
 * Get holidays for a specific month
 */
export function getHolidaysForMonth(month: number, year?: number): ITHoliday[] {
  const currentYear = year || new Date().getFullYear();
  const monthStr = String(month).padStart(2, "0");
  const start = `${currentYear}-${monthStr}-01`;

  const days = new Date(currentYear, month, 0).getDate();
  const end = `${currentYear}-${monthStr}-${String(days).padStart(2, "0")}`;

  return getHolidaysInRange(start, end);
}

/**
 * Check if holidays are synced to database for a given year
 * This helps avoid duplicate syncing
 */
export function getHolidaysSyncKey(year: number): string {
  return `it_holidays_synced_${year}`;
}
