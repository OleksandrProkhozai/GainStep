import type { Enums } from "@/types/database.types";

export type WeightUnit = Enums<"weight_unit">;

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

const weightFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

/** "62.5 kg" / "137.5 lb". */
export function formatWeight(kg: number, unit: WeightUnit) {
  return `${weightFormat.format(toDisplayWeight(kg, unit))} ${unit}`;
}

/**
 * Тоннаж для карток статистики: тисячі скорочуються як k.
 * 12 400 → "12.4k", 980 → "980". Одиниця повертається окремо,
 * щоб її можна було стилізувати дрібнішим шрифтом.
 */
export function formatVolume(kg: number, unit: WeightUnit) {
  const value = kgToUnit(kg, unit);
  const text =
    value >= 1000
      ? `${weightFormat.format(Math.round(value / 100) / 10)}k`
      : String(Math.round(value));
  return { value: text, unit };
}

// ───────────── Поля вводу ваги (екран тренування) ─────────────

const inputFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

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

/** "62.5" / "135" — вага без одиниць для таблиць і полів. */
export function formatWeightValue(kg: number, unit: WeightUnit) {
  return inputFormat.format(toInputWeight(kg, unit));
}

/** Число в одиницях користувача → кг (як зберігаємо в базі). */
export function fromDisplayWeight(value: number, unit: WeightUnit) {
  return unit === "lb" ? value * KG_PER_LB : value;
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
