/**
 * Чип "Next" у рядку вправи редактора програми: рекомендація алгоритму
 * подвійної прогресії (suggestNextWeight) з параметрами рядка й історією вправи.
 */

import { suggestNextWeight, type Session, type SuggestionAction } from "@/lib/progression";
import type { DraftExercise } from "./draft";

/** Останні тренування кожної вправи (від найновішого) — досить двох. */
export type RecentHistory = Record<string, Session[]>;

/** Скільки останніх тренувань вправи потрібно алгоритму. */
export const NEXT_HISTORY_SESSIONS = 2;

/** Map вправа → тренування (від найновішого) → об'єкт для передачі на клієнт. */
export function toRecentHistory(sessions: Map<string, readonly Session[]>): RecentHistory {
  const result: RecentHistory = {};
  for (const [exerciseId, list] of sessions) {
    result[exerciseId] = list.slice(0, NEXT_HISTORY_SESSIONS).map((s) => ({ sets: s.sets }));
  }
  return result;
}

/**
 * Вправа без ваги: equipment = bodyweight і в історії немає виконаних
 * підходів з вагою > 0. Зважені варіанти (віджимання з поясом) — звичайна
 * прогресія. Невиконані підходи не рахуються: їхня вага — лише підставлене
 * значення, а не піднята вага (так само їх ігнорує suggestNextWeight).
 */
export function isPureBodyweight(equipment: string, sessions: readonly Session[] = []): boolean {
  return (
    equipment === "bodyweight" && !sessions.some((s) => s.sets.some((set) => set.isCompleted && set.weight > 0))
  );
}

/**
 * Дані чипа (без тексту — його складає компонент мовою інтерфейсу):
 * increase "Next 62.5 kg ↑ · all sets hit 10 reps", same "… = · keep weight",
 * deload "… ↓ · deload −10%", none "No history yet", bodyweight "Bodyweight".
 */
export interface NextChip {
  /** "bodyweight" — нейтральний чип замість рекомендації ваги. */
  action: SuggestionAction | "bodyweight";
  /** Рекомендована вага, кг; null — для none і bodyweight. */
  weightKg: number | null;
  /** Верхня межа повторень (підпис "all sets hit {repMax} reps"). */
  repMax: number;
}

export function nextChip(
  row: Pick<DraftExercise, "exerciseId" | "equipment" | "targetSets" | "repMin" | "repMax" | "incrementKg">,
  history: RecentHistory,
): NextChip {
  const sessions = history[row.exerciseId] ?? [];
  if (isPureBodyweight(row.equipment, sessions)) {
    return { action: "bodyweight", weightKg: null, repMax: row.repMax };
  }
  const s = suggestNextWeight({
    history: sessions,
    repMin: row.repMin,
    repMax: row.repMax,
    targetSets: row.targetSets,
    increment: row.incrementKg,
    equipment: row.equipment,
  });
  if (s.action === "none" || s.weight === null) {
    return { action: "none", weightKg: null, repMax: row.repMax };
  }
  return { action: s.action, weightKg: s.weight, repMax: row.repMax };
}
