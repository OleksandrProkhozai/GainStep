/**
 * Чип "Next" у рядку вправи редактора програми: рекомендація алгоритму
 * подвійної прогресії (suggestNextWeight) з параметрами рядка й історією вправи.
 */

import {
  DELOAD_SESSIONS,
  isPureBodyweight,
  suggestNextWeight,
  withCompletedSets,
  type ProgressionInput,
  type Session,
  type SuggestionAction,
} from "@/lib/progression";
import { progressionIncrementKg, type WeightUnit } from "@/lib/units";
import type { DraftExercise } from "./draft";

export { isPureBodyweight };

/** Останні тренування кожної вправи (від найновішого) — досить DELOAD_SESSIONS. */
export type RecentHistory = Record<string, Session[]>;

/** Скільки останніх тренувань вправи потрібно алгоритму (правило розвантаження). */
export const NEXT_HISTORY_SESSIONS = DELOAD_SESSIONS;

/**
 * Map вправа → тренування (від найновішого) → об'єкт для передачі на клієнт.
 * Тренування, де вправу пропустили (без виконаних підходів), відкидаються ДО
 * обрізання до двох — інакше пропуск "з'їдав" би реальне тренування.
 */
export function toRecentHistory(sessions: Map<string, readonly Session[]>): RecentHistory {
  const result: RecentHistory = {};
  for (const [exerciseId, list] of sessions) {
    result[exerciseId] = withCompletedSets(list).slice(0, NEXT_HISTORY_SESSIONS);
  }
  return result;
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

type ChipRow = Pick<DraftExercise, "exerciseId" | "equipment" | "targetSets" | "repMin" | "repMax" | "incrementKg">;

/**
 * Вхід алгоритму для рядка програми: діапазон і підходи — з цього рядка
 * (поточна програма), крок — exercises.weight_increment (lb → 5 / 2.5 lb),
 * історія — по вправі з усіх тренувань. Той самий вхід — для пояснення.
 */
export function nextInput(row: ChipRow, history: RecentHistory, unit: WeightUnit = "kg"): ProgressionInput {
  return {
    history: history[row.exerciseId] ?? [],
    repMin: row.repMin,
    repMax: row.repMax,
    targetSets: row.targetSets,
    increment: progressionIncrementKg(row.incrementKg, unit),
    equipment: row.equipment,
  };
}

export function nextChip(
  row: ChipRow,
  history: RecentHistory,
  /** Одиниці користувача: для lb крок прогресії — 5 / 2.5 lb. */
  unit: WeightUnit = "kg",
): NextChip {
  const input = nextInput(row, history, unit);
  if (isPureBodyweight(row.equipment, input.history)) {
    return { action: "bodyweight", weightKg: null, repMax: row.repMax };
  }
  const s = suggestNextWeight(input);
  if (s.action === "none" || s.weight === null) {
    return { action: "none", weightKg: null, repMax: row.repMax };
  }
  return { action: s.action, weightKg: s.weight, repMax: row.repMax };
}
