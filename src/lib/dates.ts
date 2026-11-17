/**
 * Робота з календарними датами в часовому поясі користувача.
 * Дата — рядок "YYYY-MM-DD"; арифметика з такими датами йде в UTC,
 * тож переходи на літній/зимовий час її не зачіпають.
 */

export const USER_TIME_ZONE = "Europe/Kiev";

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/** Календарна дата моменту `date` у поясі `timeZone`: "YYYY-MM-DD". */
export function toDayKey(date: Date | string, timeZone = USER_TIME_ZONE) {
  let fmt = dayKeyFormatters.get(timeZone);
  if (!fmt) {
    // en-CA форматує дату саме як YYYY-MM-DD
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayKeyFormatters.set(timeZone, fmt);
  }
  return fmt.format(typeof date === "string" ? new Date(date) : date);
}

function parseDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number) {
  const date = parseDayKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDayKey(date);
}

/** Понеділок тижня, до якого належить дата. */
export function startOfWeek(key: string) {
  const weekday = parseDayKey(key).getUTCDay(); // 0 = неділя
  return addDays(key, -((weekday + 6) % 7));
}
