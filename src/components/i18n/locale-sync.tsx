"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE, localeCookieString, type Locale } from "@/i18n/config";

/**
 * Вирівнює <html lang> і cookie NEXT_LOCALE з мовою, яку визначив сервер
 * (наприклад, мова з профілю на новому пристрої). Тоді inline-скрипт у
 * layout і сторінки входу після виходу вже знають правильну мову.
 */
export function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    const current = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))?.[1];
    if (current !== locale) document.cookie = localeCookieString(locale);
  }, [locale]);
  return null;
}
