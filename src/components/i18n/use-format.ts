"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { useLocale } from "next-intl";
import { useUnit } from "@/components/preferences/preferences-provider";
import { dateFnsLocale, DATE_PATTERNS, type DatePattern } from "@/lib/i18n/dates";
import { createWeightFormat } from "@/lib/units";

/** Форматери ваги в одиницях користувача і мові інтерфейсу ("62,5 кг"). */
export function useWeightFormat() {
  const unit = useUnit();
  const locale = useLocale();
  return useMemo(() => createWeightFormat(unit, locale), [unit, locale]);
}

/** Локаль date-fns для поточної мови (місяці, дні тижня). */
export function useDateFnsLocale() {
  return dateFnsLocale(useLocale());
}

/**
 * Дата за шаблоном мови інтерфейсу: short "Nov 17" / "17 лист.",
 * weekday "Tue, Nov 17" / "вт, 17 лист.", full "Tue, Nov 17, 2026" / "вт, 17 лист. 2026".
 */
export function useDateFns() {
  const locale = useLocale();
  return useMemo(
    () => (date: Date | number, pattern: DatePattern) =>
      format(date, DATE_PATTERNS[locale === "uk" ? "uk" : "en"][pattern], { locale: dateFnsLocale(locale) }),
    [locale],
  );
}
