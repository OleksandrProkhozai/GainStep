/**
 * Місяці історії: параметр ?month=YYYY-MM, межі місяця як календарні дні
 * ("YYYY-MM-DD") у поясі користувача. Чисті функції без поточної дати.
 */

import { addDays } from "@/lib/dates";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "2026-11" → "2026-11"; некоректне значення → null. */
export function parseMonthParam(value: unknown): string | null {
  return typeof value === "string" && MONTH_RE.test(value) ? value : null;
}

/** "2026-11-19" → "2026-11-19"; некоректне значення → null. */
export function parseDayParam(value: unknown): string | null {
  return typeof value === "string" && DAY_RE.test(value) ? value : null;
}

/** Місяць дня: "2026-11-19" → "2026-11". */
export function monthOf(dayKey: string) {
  return dayKey.slice(0, 7);
}

/** Зсув місяця: shiftMonth("2026-01", -1) → "2025-12". */
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Перший і останній день місяця: "2026-02" → ["2026-02-01", "2026-02-28"]. */
export function monthBounds(month: string): { first: string; last: string } {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  return { first, last };
}

/**
 * Діапазон днів, що показує історія: обраний місяць і ще `more` попередніх
 * ("Показати попередній місяць").
 */
export function historyRange(month: string, more = 0) {
  return { first: monthBounds(shiftMonth(month, -Math.max(0, more))).first, last: monthBounds(month).last };
}

/**
 * Межі запиту за started_at з запасом у день з кожного боку: пояс
 * користувача (Europe/Kiev) зсунутий від UTC не більше ніж на 3 год, тож
 * усі тренування діапазону гарантовано потраплять у вибірку, а точне
 * відсікання робить toDayKey вже в JS.
 */
export function queryBounds(first: string | null, last: string) {
  return {
    from: first ? `${addDays(first, -1)}T00:00:00Z` : null,
    to: `${addDays(last, 2)}T00:00:00Z`,
  };
}

/** Чи належить день діапазону (включно). */
export function inRange(dayKey: string, first: string | null, last: string) {
  return (first === null || dayKey >= first) && dayKey <= last;
}
