import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";
import { REST_LIMITS } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Сесія і профіль поточного запиту; null — не залогінений (без редиректу).
 * Читає cookies, тому викликати лише всередині <Suspense>.
 * Обгорнуто в React cache(): у межах одного запиту layout, сторінка і
 * визначення мови (i18n/request.ts) отримують той самий результат без
 * повторних запитів до Supabase. Між запитами (і користувачами) не кешується.
 */
export const getSession = cache(async function getSession() {
  // Supabase перевіряє термін дії токена через Date.now(), що заборонено
  // під час пререндеру (Cache Components) — тож чекаємо реального запиту.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const profile = await loadProfile(supabase, claims.sub);

  return {
    id: claims.sub,
    email: claims.email ?? null,
    displayName: profile?.display_name ?? null,
    onboarded: Boolean(profile?.onboarded_at),
    unit: profile?.unit ?? "kg",
    experience: profile?.experience ?? null,
    goal: profile?.goal ?? null,
    defaultRestSeconds: profile?.default_rest_seconds ?? REST_LIMITS.fallback,
    /** null — колонки ще немає (міграцію i18n не застосовано). */
    locale: (isLocale(profile?.locale) ? profile.locale : null) as Locale | null,
  };
});

/**
 * Поточний користувач для Server Components (Data Access Layer); без сесії —
 * редирект на /login. Єдине серверне джерело налаштувань профілю (unit,
 * таймер, рівень, ціль, мова). На клієнті unit і таймер віддає
 * PreferencesProvider з layout (useUnit / useDefaultRest), мову — next-intl.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ProfileRow = {
  display_name: string | null;
  onboarded_at: string | null;
  unit: "kg" | "lb";
  experience: "beginner" | "intermediate" | null;
  goal: "strength" | "hypertrophy" | null;
  default_rest_seconds: number;
  locale: string | null;
};

async function loadProfile(supabase: Supabase, userId: string): Promise<ProfileRow | null> {
  const res = await supabase
    .from("profiles")
    .select("display_name, onboarded_at, unit, experience, goal, default_rest_seconds, locale")
    .eq("id", userId)
    .maybeSingle();
  // 42703 — нових колонок ще немає (міграції settings / i18n не застосовано).
  // Без цього профіль був би null і користувача кидало б в онбординг.
  if (res.error?.code === "42703") {
    // Спершу без locale (i18n), потім і без default_rest_seconds (settings).
    const noLocale = await supabase
      .from("profiles")
      .select("display_name, onboarded_at, unit, experience, goal, default_rest_seconds")
      .eq("id", userId)
      .maybeSingle();
    if (!noLocale.error) return noLocale.data ? { ...noLocale.data, locale: null } : null;
    const legacy = await supabase
      .from("profiles")
      .select("display_name, onboarded_at, unit, experience, goal")
      .eq("id", userId)
      .maybeSingle();
    return legacy.data ? { ...legacy.data, default_rest_seconds: REST_LIMITS.fallback, locale: null } : null;
  }
  return res.data;
}
