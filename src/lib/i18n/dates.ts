import { format } from "date-fns";
import { enGB, uk } from "date-fns/locale";

/** Локаль date-fns: місяці й дні тижня мовою інтерфейсу. */
export function dateFnsLocale(locale: string) {
  return locale === "uk" ? uk : enGB;
}

/** Шаблони date-fns для кожної мови (порядок дня й місяця різний). */
export const DATE_PATTERNS = {
  en: { short: "MMM d", weekday: "EEE, MMM d", full: "EEE, MMM d, yyyy" },
  uk: { short: "d MMM", weekday: "EEEEEE, d MMM", full: "EEEEEE, d MMM yyyy" },
} as const;

export type DatePattern = keyof (typeof DATE_PATTERNS)["en"];

/** Те саме без хуків — для серверних компонентів. */
export function formatDate(date: Date | number, pattern: DatePattern, locale: string) {
  return format(date, DATE_PATTERNS[locale === "uk" ? "uk" : "en"][pattern], { locale: dateFnsLocale(locale) });
}
