/**
 * Вага тіла: валідація вводу, перетворення одиниць і розрахунки для
 * картки "Body weight". Чисті функції — працюють на сервері, клієнті й у тестах.
 * У базі вага в кг; один запис на день (unique user_id + recorded_on).
 */

import { cleanFloat } from "@/lib/metrics";
import { fromDisplayWeight, kgToUnit, type WeightUnit } from "@/lib/units";

export type BodyWeightEntry = {
  /** "YYYY-MM-DD". */
  date: string;
  weightKg: number;
};

/** Допустимий діапазон вводу в одиницях користувача. */
export const BODY_WEIGHT_LIMITS: Record<WeightUnit, { min: number; max: number }> = {
  kg: { min: 30, max: 300 },
  lb: { min: 66, max: 660 },
};

const INPUT_PATTERN = /^\d{1,3}([.,]\d)?$/;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/** Перевіряє число, введене в одиницях користувача: діапазон і не більше одного знаку після коми. */
export function validateBodyWeight(value: number, unit: WeightUnit): ParseResult {
  const { min, max } = BODY_WEIGHT_LIMITS[unit];
  if (!Number.isFinite(value) || value < min || value > max) {
    // Межі (min/max/unit) клієнт підставляє з BODY_WEIGHT_LIMITS.
    return { ok: false, error: "weightRange" };
  }
  if (Math.abs(Math.round(value * 10) - value * 10) > 1e-6) {
    return { ok: false, error: "weightOneDecimal" };
  }
  return { ok: true, value: Math.round(value * 10) / 10 };
}

/** Розбирає текст поля ("73,4" теж приймається). */
export function parseBodyWeightInput(text: string, unit: WeightUnit): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "weightRequired" };
  if (!INPUT_PATTERN.test(trimmed)) {
    return /[.,]\d{2,}$/.test(trimmed)
      ? { ok: false, error: "weightOneDecimal" }
      : { ok: false, error: "weightNotNumber" };
  }
  return validateBodyWeight(Number(trimmed.replace(",", ".")), unit);
}

/** Вага в одиницях користувача, до 0.1. */
export function toBodyUnit(kg: number, unit: WeightUnit): number {
  return Math.round(kgToUnit(kg, unit) * 10) / 10;
}

/** Значення в одиницях користувача → кг для бази (numeric(5,2)). */
export function bodyWeightToKg(value: number, unit: WeightUnit): number {
  const kg = fromDisplayWeight(value, unit);
  return Math.round(kg * 100) / 100;
}

/** Чи є рядок справжньою календарною датою "YYYY-MM-DD". */
export function isDayKey(key: string): boolean {
  if (!DAY_KEY_PATTERN.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export interface BodyWeightSummary {
  latest: BodyWeightEntry | null;
  /** Записи вибраного періоду, від старих до нових. */
  inPeriod: BodyWeightEntry[];
  /** Зміна від першого запису періоду до останнього, в одиницях користувача; null — менше 2 записів. */
  delta: number | null;
  /** Дата першого запису періоду (для підпису "vs Nov 3"). */
  since: string | null;
}

/**
 * Підсумок для картки.
 * @param entries усі записи від старих до нових
 * @param fromKey перший день періоду "YYYY-MM-DD"; null — уся історія
 */
export function summarizeBodyWeight(
  entries: readonly BodyWeightEntry[],
  fromKey: string | null,
  unit: WeightUnit,
): BodyWeightSummary {
  const inPeriod = fromKey === null ? [...entries] : entries.filter((e) => e.date >= fromKey);
  const first = inPeriod[0];
  const last = inPeriod.at(-1);
  const hasDelta = inPeriod.length >= 2 && first && last;
  return {
    latest: entries.at(-1) ?? null,
    inPeriod,
    delta: hasDelta ? cleanFloat(toBodyUnit(last.weightKg, unit) - toBodyUnit(first.weightKg, unit), 1) : null,
    since: hasDelta ? first.date : null,
  };
}

/** Домен осі Y: [min − 1, max + 1], округлений до цілих (не від нуля). */
export function weightDomain(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  return [Math.floor(Math.min(...values) - 1), Math.ceil(Math.max(...values) + 1)];
}

export interface HistoryRow extends BodyWeightEntry {
  /** Різниця з попереднім (старшим) записом в одиницях користувача; null для першого. */
  diff: number | null;
}

/** Історія від нових до старих із різницею відносно попереднього запису. */
export function historyRows(entries: readonly BodyWeightEntry[], unit: WeightUnit): HistoryRow[] {
  return entries
    .map((e, i) => ({
      ...e,
      diff:
        i === 0 ? null : cleanFloat(toBodyUnit(e.weightKg, unit) - toBodyUnit(entries[i - 1].weightKg, unit), 1),
    }))
    .reverse();
}
