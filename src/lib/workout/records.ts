/**
 * Єдиний підрахунок рекордів для екрана тренування, підсумку й дашборду:
 * кількість ВПРАВ, у яких у тренуванні був хоча б один рекорд.
 * Сама перевірка рекорду — historyBest / markPRs з progression.ts.
 */

import {
  historyBest,
  markPRs,
  type PersonalBest,
  type SetResult,
} from "@/lib/progression";

/** Підходи вправи в тренуванні + найкращі показники історії ДО нього. */
export interface ExercisePRInput {
  sets: readonly SetResult[];
  best: PersonalBest | null;
}

/** Чи є у вправі хоча б один рекордний підхід. */
export function hasPR({ sets, best }: ExercisePRInput): boolean {
  return markPRs(sets, best).some(Boolean);
}

/** Кількість вправ з рекордом у тренуванні. */
export function countPRExercises(exercises: readonly ExercisePRInput[]): number {
  return exercises.filter(hasPR).length;
}

/** Тренування вправи в історії. */
export interface ExerciseSession {
  workoutId: string;
  startedAt: string;
  sets: SetResult[];
}

/**
 * Кількість вправ з рекордом, підсумована по заданих тренуваннях
 * (наприклад, за поточний тиждень). Кожне тренування порівнюється
 * лише з історією ДО нього: для кожної вправи йдемо від найстарішого
 * тренування, накопичуючи найкращі показники.
 *
 * @param sessionsByExercise тренування кожної вправи (у будь-якому порядку)
 * @param workoutIds тренування, рекорди яких рахуємо
 */
export function countPRExercisesInWorkouts(
  sessionsByExercise: Iterable<readonly ExerciseSession[]>,
  workoutIds: ReadonlySet<string>,
): number {
  const perWorkout = new Map<string, ExercisePRInput[]>();
  for (const sessions of sessionsByExercise) {
    const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    let best: PersonalBest | null = null;
    for (const session of ordered) {
      if (workoutIds.has(session.workoutId)) {
        const list = perWorkout.get(session.workoutId) ?? [];
        list.push({ sets: session.sets, best });
        perWorkout.set(session.workoutId, list);
      }
      best = mergeBest(best, historyBest([session]));
    }
  }
  let total = 0;
  for (const list of perWorkout.values()) total += countPRExercises(list);
  return total;
}

function mergeBest(a: PersonalBest | null, b: PersonalBest | null): PersonalBest | null {
  if (!a) return b;
  if (!b) return a;
  return {
    maxWeight: Math.max(a.maxWeight, b.maxWeight),
    bestE1RM: Math.max(a.bestE1RM, b.bestE1RM),
  };
}
