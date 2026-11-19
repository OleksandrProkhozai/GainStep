/**
 * URL сторінки історії: фільтри живуть у search params
 * (/workouts/history?month=2026-11&program=…&exercise=…&q=…&day=…&more=1).
 */

import { z } from "zod";
import { parseDayParam, parseMonthParam } from "./month";

export const HISTORY_PATH = "/workouts/history";
/** Скільки попередніх місяців можна "догрузити" кнопкою. */
export const MORE_MAX = 24;
export const QUERY_MAX = 100;

export interface HistoryQuery {
  month: string;
  more: number;
  program: string | null;
  exercise: string | null;
  q: string | null;
  day: string | null;
}

const guid = z.guid();
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Search params → валідний запит; некоректні значення відкидаються. */
export function parseHistoryQuery(
  params: Record<string, string | string[] | undefined>,
  defaultMonth: string,
): HistoryQuery {
  const month = parseMonthParam(first(params.month)) ?? defaultMonth;
  const moreRaw = Number(first(params.more));
  const program = first(params.program);
  const exercise = first(params.exercise);
  const q = first(params.q)?.trim().slice(0, QUERY_MAX) || null;
  const day = parseDayParam(first(params.day));
  return {
    month,
    more: Number.isInteger(moreRaw) ? Math.min(MORE_MAX, Math.max(0, moreRaw)) : 0,
    program: program && guid.safeParse(program).success ? program : null,
    exercise: exercise && guid.safeParse(exercise).success ? exercise : null,
    q,
    // День має належати обраному місяцю.
    day: day && day.startsWith(month) ? day : null,
  };
}

/** Запит → посилання. Порожні значення не потрапляють в URL. */
export function historyHref(query: Partial<HistoryQuery> & { month: string }) {
  const p = new URLSearchParams();
  p.set("month", query.month);
  if (query.program) p.set("program", query.program);
  if (query.exercise) p.set("exercise", query.exercise);
  if (query.q) p.set("q", query.q);
  if (query.day) p.set("day", query.day);
  if (query.more) p.set("more", String(query.more));
  return `${HISTORY_PATH}?${p.toString()}`;
}
