/**
 * Робота з календарними датами в часовому поясі користувача.
 * Дата — рядок "YYYY-MM-DD"; арифметика з такими датами йде в UTC,
 * тож переходи на літній/зимовий час її не зачіпають.
 */

export const USER_TIME_ZONE = "Europe/Kiev";

/** BCP 47 для Intl: en — британський порядок дат ("17 Nov"), uk — українська. */
export function intlLocale(locale: string) {
  return locale === "uk" ? "uk-UA" : "en-GB";
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Кешований Intl.DateTimeFormat у поясі користувача і мові інтерфейсу. */
export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(options);
  let fmt = dateFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: USER_TIME_ZONE, ...options });
    dateFormatters.set(key, fmt);
  }
  return fmt;
}

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

/** Тривалість для показу: "52 min" / "1 h 05 min". */
export function formatMinutes(minutes: number, locale = "en") {
  const [h, m] = locale === "uk" ? ["год", "хв"] : ["h", "m"];
  if (minutes < 60) return locale === "uk" ? `${minutes} ${m}` : `${minutes} min`;
  return `${Math.floor(minutes / 60)}${locale === "uk" ? " " : ""}${h} ${String(minutes % 60).padStart(2, "0")}${locale === "uk" ? " " : ""}${m}`;
}
