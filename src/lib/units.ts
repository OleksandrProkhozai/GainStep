import type { Enums } from "@/types/database.types";

export type WeightUnit = Enums<"weight_unit">;

/** Мова форматування чисел ("en" | "uk"); рядок — щоб units.ts не залежав від i18n. */
export type NumberLocale = string;

const formatters = new Map<string, Intl.NumberFormat>();

/** Кешований Intl.NumberFormat: "62.5" (en) / "62,5" (uk). */
export function numberFormat(locale: NumberLocale, maximumFractionDigits = 1, useGrouping = true) {
  const key = `${locale}|${maximumFractionDigits}|${useGrouping}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { maximumFractionDigits, useGrouping });
    formatters.set(key, fmt);
  }
  return fmt;
}

/** Число з до 1 знаку після коми в мові інтерфейсу. */
export function formatNumber(value: number, locale: NumberLocale = "en") {
  return numberFormat(locale).format(value);
}

/** Підпис одиниці: uk — "кг", lb лишається lb. */
export function unitLabel(unit: WeightUnit, locale: NumberLocale = "en") {
  return unit === "kg" && locale === "uk" ? "кг" : unit;
}

/** Точне значення: 1 lb = 0.45359237 kg. */
export const KG_PER_LB = 0.45359237;

/** Округлення до 0.5 (крок, з яким зазвичай вішають диски). */
export function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

/** Переводить кг (як у базі) в одиниці користувача без округлення. */
export function kgToUnit(kg: number, unit: WeightUnit) {
  return unit === "lb" ? kg / KG_PER_LB : kg;
}

/** Вага для показу: в одиницях користувача, округлена до 0.5. */
export function toDisplayWeight(kg: number, unit: WeightUnit) {
  return roundToHalf(kgToUnit(kg, unit));
}

/** "62.5 kg" / "137.5 lb"; uk — "62,5 кг". */
export function formatWeight(kg: number, unit: WeightUnit, locale: NumberLocale = "en") {
  return `${formatNumber(toDisplayWeight(kg, unit), locale)} ${unitLabel(unit, locale)}`;
}

/**
 * Тоннаж для карток статистики: тисячі скорочуються як k.
 * 12 400 → "12.4k" (uk: "12,4k"), 980 → "980". Одиниця повертається
 * окремо (уже перекладена), щоб її можна було стилізувати дрібнішим шрифтом.
 */
export function formatVolume(kg: number, unit: WeightUnit, locale: NumberLocale = "en") {
  const value = kgToUnit(kg, unit);
  const text =
    value >= 1000
      ? `${formatNumber(Math.round(value / 100) / 10, locale)}k`
      : String(Math.round(value));
  return { value: text, unit: unitLabel(unit, locale) };
}

// ───────────── Поля вводу ваги (екран тренування) ─────────────

/**
 * Значення для поля вводу ваги. Для кг — до 0.01 (диски 1.25 кг
 * дають 61.25, тож округлення до 0.5 тут не годиться). Для lb — до 0.5,
 * щоб 135 lb після перетворення в кг і назад (61.24 кг) знову було 135.
 */
export function toInputWeight(kg: number, unit: WeightUnit) {
  return unit === "lb"
    ? roundToHalf(kgToUnit(kg, unit))
    : Math.round(kg * 100) / 100;
}

/** "62.5" / "135" (uk: "62,5") — вага без одиниць для таблиць і полів. */
export function formatWeightValue(kg: number, unit: WeightUnit, locale: NumberLocale = "en") {
  return numberFormat(locale, 2, false).format(toInputWeight(kg, unit));
}

/** Число в одиницях користувача → кг (як зберігаємо в базі). */
export function fromDisplayWeight(value: number, unit: WeightUnit) {
  return unit === "lb" ? value * KG_PER_LB : value;
}

/**
 * Значення з поля вводу (в одиницях користувача) → кг без дрейфу.
 * Якщо поле показує те саме, що й originalKg, повертаємо originalKg:
 * 62.5 kg показується як 138 lb, і без змін має лишитись 62.5, а не 62.6.
 */
export function inputToKg(value: number, unit: WeightUnit, originalKg?: number | null) {
  if (originalKg != null && value === toInputWeight(originalKg, unit)) return originalKg;
  return fromDisplayWeight(value, unit);
}

/**
 * Крок степера ваги в одиницях користувача.
 * kg — крок вправи (weight_increment). lb — 5 lb, а для дрібних кроків
 * (менше 2.5 кг: гантелі, ізоляція) — 2.5 lb.
 */
export function weightStep(incrementKg: number, unit: WeightUnit) {
  if (unit === "kg") return incrementKg;
  return incrementKg < 2.5 ? 2.5 : 5;
}

/** Усі форматери ваги для конкретних одиниць і мови (клієнт: useWeightFormat). */
export function createWeightFormat(unit: WeightUnit, locale: NumberLocale) {
  return {
    unit,
    locale,
    /** "кг" / "kg" / "lb". */
    unitLabel: unitLabel(unit, locale),
    weight: (kg: number) => formatWeight(kg, unit, locale),
    value: (kg: number) => formatWeightValue(kg, unit, locale),
    volume: (kg: number) => formatVolume(kg, unit, locale),
    number: (value: number) => formatNumber(value, locale),
  };
}

export type WeightFormat = ReturnType<typeof createWeightFormat>;
