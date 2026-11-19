import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";

/**
 * Мова поточного запиту: профіль > cookie NEXT_LOCALE > Accept-Language.
 * Читає cookies/headers і сесію — значення залежить від запиту і ніколи
 * не потрапляє в спільний кеш (у проєкті немає `use cache`; якщо з'явиться,
 * locale треба передавати в кешовані функції аргументом — він стане ключем).
 * React cache() — лише в межах одного запиту.
 */
export const getRequestLocale = cache(async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerList, session] = await Promise.all([cookies(), headers(), getSession()]);
  return resolveLocale({
    profileLocale: session?.locale,
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
});
