/**
 * Vietnam timezone utilities.
 * All date/time operations that need to be timezone-aware should use VN_TZ.
 */

export const VN_TZ = "Asia/Ho_Chi_Minh";

/**
 * Returns the current date string (YYYY-MM-DD) in Vietnam timezone (UTC+7).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Returns a Date range [start, end] covering the full day for a YYYY-MM-DD string,
 * interpreted in Vietnam timezone (UTC+7).
 *
 * Example: getVnDayRange("2026-06-09")
 *   start = 2026-06-08T17:00:00.000Z  (00:00 VN = 17:00 UTC prev day)
 *   end   = 2026-06-09T16:59:59.999Z  (23:59:59.999 VN = 16:59 UTC)
 */
export function getVnDayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

/**
 * Formats a Date to HH:mm:ss dd/MM/yyyy in Vietnam timezone.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = date instanceof Date ? date : new Date(date as string);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("vi-VN", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
