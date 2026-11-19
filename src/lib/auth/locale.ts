import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, resolveLocale, type Locale } from "@/i18n/config";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Не httpOnly: inline-скрипт у layout читає мову для <html lang>.
    httpOnly: false,
  });
}

/** Мова інтерфейсу до входу: cookie > Accept-Language. */
async function preAuthLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
}

/**
 * Після входу: cookie NEXT_LOCALE = мова профілю, щоб і сторінки входу після
 * виходу, і <html lang> мали ту саму мову. Нового користувача (тригер
 * створює профіль з 'en') — навпаки: профіль бере мову, якою він реєструвався.
 */
export async function syncLocaleAfterAuth(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("locale, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return; // колонки locale ще немає — міграцію i18n не застосовано
  if (!data.onboarded_at) {
    const locale = await preAuthLocale();
    if (locale !== data.locale) await supabase.from("profiles").update({ locale }).eq("id", userId);
    await setLocaleCookie(locale);
  } else if (isLocale(data.locale)) {
    await setLocaleCookie(data.locale);
  }
}
