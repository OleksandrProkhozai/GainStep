/**
 * Мови інтерфейсу і визначення мови запиту. Чисті функції — без next/headers,
 * тож працюють у proxy, server actions, на клієнті й у тестах.
 */

export const LOCALES = ["en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie з мовою: виставляється при вході й при зміні мови в Settings. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
/** Рік — мова не має "злітати" між візитами. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = { en: "English", uk: "Українська" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Accept-Language → мова: перша підтримувана за пріоритетом (q).
 * uk і ru → uk, en → en, інші пропускаються; нічого не знайшли — en.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((x) => x.lang && x.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { lang } of ranked) {
    if (lang === "uk" || lang === "ru") return "uk";
    if (lang === "en") return "en";
  }
  return DEFAULT_LOCALE;
}

/**
 * Пріоритет: мова з профілю (залогінений) > cookie NEXT_LOCALE > Accept-Language.
 */
export function resolveLocale(input: {
  profileLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.profileLocale)) return input.profileLocale;
  if (isLocale(input.cookieLocale)) return input.cookieLocale;
  return localeFromAcceptLanguage(input.acceptLanguage);
}

/** Значення Set-Cookie для клієнта (document.cookie): не httpOnly — його читає скрипт lang. */
export function localeCookieString(locale: Locale) {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
