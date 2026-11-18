/**
 * Чисті функції екрана активного тренування: початкові підходи, підказка,
 * рекорди, статистика. Уся «розумна» логіка (прогресія, 1ПМ, рекорди)
 * береться з src/lib/progression.ts і src/lib/metrics.ts — тут лише
 * адаптація під структуру стору.
 */

import { epley1RM, sessionVolume } from "@/lib/metrics";
import {
  markPRs,
  suggestNextWeight,
  type SetResult,
  type Suggestion,
} from "@/lib/progression";
import { countPRExercises } from "./records";
import type { SavedSet, WorkoutExercise, WorkoutSet } from "./types";

export const WEIGHT_MAX_KG = 500;
export const REPS_MAX = 100;

export function clampWeightKg(kg: number) {
  if (!Number.isFinite(kg)) return 0;
  return Math.min(WEIGHT_MAX_KG, Math.max(0, Math.round(kg * 100) / 100));
}

export function clampReps(reps: number) {
  if (!Number.isFinite(reps)) return 0;
  return Math.min(REPS_MAX, Math.max(0, Math.round(reps)));
}

/** Унікальний id підходу. crypto.randomUUID недоступний поза HTTPS (телефон у LAN). */
export function newClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      // незахищений контекст — нижче запасний варіант
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Рекомендація алгоритму подвійної прогресії для вправи. */
export function getSuggestion(exercise: WorkoutExercise): Suggestion {
  return suggestNextWeight({
    history: exercise.history,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    targetSets: exercise.targetSets,
    increment: exercise.increment,
  });
}

/** Підхід з тим самим номером з останнього тренування (колонка Previous). */
export function previousSet(
  exercise: WorkoutExercise,
  setNumber: number,
): SetResult | null {
  return exercise.history[0]?.sets[setNumber - 1] ?? null;
}

/**
 * Початкові підходи вправи (кількість = target_sets):
 * - вага = рекомендація алгоритму; для 'none' — вага першого підходу
 *   минулого разу, для вправ з власною вагою — 0, інакше порожньо;
 * - повторення = rep_min після increase/deload (нова вага — починаємо
 *   з низу діапазону), інакше — як у відповідному підході минулого разу
 *   (або rep_max).
 */
export function initialSets(
  exercise: WorkoutExercise,
  makeId: () => string = newClientId,
): WorkoutSet[] {
  const suggestion = getSuggestion(exercise);
  const weightKg =
    suggestion.weight ??
    exercise.history[0]?.sets[0]?.weight ??
    (exercise.equipment === "bodyweight" ? 0 : null);
  const resetReps = suggestion.action === "increase" || suggestion.action === "deload";

  return Array.from({ length: exercise.targetSets }, (_, i) => ({
    clientId: makeId(),
    exerciseId: exercise.exerciseId,
    setNumber: i + 1,
    weightKg,
    reps: resetReps
      ? exercise.repMin
      : (previousSet(exercise, i + 1)?.reps ?? exercise.repMax),
    isCompleted: false,
    completedAt: null,
    tracked: false,
  }));
}

/**
 * Підходи на старті екрана: для вправ, що вже мають рядки в базі
 * (продовження на іншому пристрої), — збережені підходи, для решти — initialSets.
 */
export function buildSets(
  exercises: WorkoutExercise[],
  saved: SavedSet[],
  makeId: () => string = newClientId,
): WorkoutSet[] {
  return exercises.flatMap((exercise) => {
    const own = saved
      .filter((s) => s.exerciseId === exercise.exerciseId)
      .sort((a, b) => a.setNumber - b.setNumber);
    if (own.length === 0) return initialSets(exercise, makeId);
    return own.map((s, i) => ({
      clientId: makeId(),
      exerciseId: exercise.exerciseId,
      setNumber: i + 1,
      weightKg: s.weightKg,
      reps: s.reps,
      isCompleted: s.isCompleted,
      completedAt: s.completedAt,
      tracked: true,
    }));
  });
}

/** Підходи вправи в порядку номерів. */
export function setsOf(sets: WorkoutSet[], exerciseId: string) {
  return sets
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => a.setNumber - b.setNumber);
}

/**
 * Зміна ваги підходу: нова вага переноситься на наступні НЕвиконані
 * підходи цієї ж вправи (типовий сценарій — підібрав вагу в першому підході).
 */
export function applyWeight(
  sets: WorkoutSet[],
  clientId: string,
  weightKg: number,
): WorkoutSet[] {
  const target = sets.find((s) => s.clientId === clientId);
  if (!target) return sets;
  return sets.map((s) => {
    if (s.clientId === clientId) return { ...s, weightKg };
    if (
      s.exerciseId === target.exerciseId &&
      s.setNumber > target.setNumber &&
      !s.isCompleted
    ) {
      return { ...s, weightKg };
    }
    return s;
  });
}

/** Видалення підходу з перенумерацією решти підходів вправи (1, 2, 3…). */
export function removeSet(sets: WorkoutSet[], clientId: string): WorkoutSet[] {
  const target = sets.find((s) => s.clientId === clientId);
  if (!target) return sets;
  return sets
    .filter((s) => s.clientId !== clientId)
    .map((s) =>
      s.exerciseId === target.exerciseId && s.setNumber > target.setNumber
        ? { ...s, setNumber: s.setNumber - 1 }
        : s,
    );
}

/** Новий підхід у кінці вправи — копія значень останнього підходу. */
export function appendSet(
  sets: WorkoutSet[],
  exercise: WorkoutExercise,
  makeId: () => string = newClientId,
): WorkoutSet[] {
  const own = setsOf(sets, exercise.exerciseId);
  const last = own.at(-1);
  const template = last ?? initialSets({ ...exercise, targetSets: 1 }, makeId)[0];
  return [
    ...sets,
    {
      clientId: makeId(),
      exerciseId: exercise.exerciseId,
      setNumber: own.length + 1,
      weightKg: template.weightKg,
      reps: template.reps,
      isCompleted: false,
      completedAt: null,
      tracked: false,
    },
  ];
}

const toResult = (s: WorkoutSet): SetResult => ({
  weight: s.weightKg ?? 0,
  reps: s.reps,
  isCompleted: s.isCompleted,
});

/** clientId підходів, що є особистими рекордами (наживо, за markPRs). */
export function prIds(exercise: WorkoutExercise, sets: WorkoutSet[]): Set<string> {
  const own = setsOf(sets, exercise.exerciseId);
  const flags = markPRs(own.map(toResult), exercise.best);
  return new Set(own.filter((_, i) => flags[i]).map((s) => s.clientId));
}

/** Найбільший розрахунковий 1ПМ серед виконаних підходів (0 — якщо немає). */
export function bestE1RMToday(sets: WorkoutSet[]) {
  return sets.reduce(
    (best, s) =>
      s.isCompleted && s.weightKg !== null
        ? Math.max(best, epley1RM(s.weightKg, s.reps))
        : best,
    0,
  );
}

/**
 * Підсумок для картки "This workout".
 * prs — кількість вправ з рекордом (як на підсумку й дашборді).
 */
export function workoutStats(exercises: WorkoutExercise[], sets: WorkoutSet[]) {
  return {
    volumeKg: sessionVolume(sets.map(toResult)),
    setsDone: sets.filter((s) => s.isCompleted).length,
    prs: countPRExercises(
      exercises.map((e) => ({ sets: setsOf(sets, e.exerciseId).map(toResult), best: e.best })),
    ),
  };
}

/** Перший невиконаний підхід вправи. */
export function firstPending(sets: WorkoutSet[], exerciseId: string) {
  return setsOf(sets, exerciseId).find((s) => !s.isCompleted) ?? null;
}

/**
 * Наступний підхід для підказки "Next: Set 3 · 62.5 kg × 12":
 * спершу в поточній вправі, далі — у наступних.
 */
export function nextPendingSet(
  exercises: WorkoutExercise[],
  sets: WorkoutSet[],
  currentIndex: number,
) {
  for (let i = currentIndex; i < exercises.length; i++) {
    const set = firstPending(sets, exercises[i].exerciseId);
    if (set) return { exercise: exercises[i], set };
  }
  return null;
}
