/**
 * Тренування на пристрої — чисті функції без React і localStorage:
 * старт без мережі з кешованої програми, лічильник непідтверджених
 * підходів і локальний підсумок (ті самі функції summary.ts, що й сервер).
 */

import type { WeightUnit } from "@/lib/units";
import type { OfflineKit } from "@/lib/workout/queries";
import { buildWorkoutSummary, type WorkoutSummary } from "@/lib/workout/summary";
import type { WorkoutExercise, WorkoutInit, WorkoutSet } from "@/lib/workout/types";

/**
 * Початкові дані тренування, почато без мережі: день — з кешованої
 * програми, id — згенерований на клієнті. Рядок у workouts створить
 * черга синхронізації (created: false); склад теж піде з черги.
 * null — дня немає в кеші або в ньому немає вправ.
 */
export function buildLocalWorkoutInit(
  kit: OfflineKit | null,
  dayId: string,
  workoutId: string,
  now: Date,
): WorkoutInit | null {
  const day = kit?.days.find((d) => d.id === dayId);
  if (!kit || !day || day.exercises.length === 0) return null;
  return {
    workoutId,
    name: day.name,
    programName: kit.programName,
    startedAt: now.toISOString(),
    notes: "",
    exercises: day.exercises,
    savedSets: [],
    planStored: false,
    created: false,
    programDayId: day.id,
  };
}

/**
 * Скільки підходів чекають синхронізації: підходи з рядком у базі
 * (tracked) у вправах із черги. Якщо рядка тренування ще немає —
 * усі такі підходи.
 */
export function countUnsyncedSets(state: {
  sets: readonly WorkoutSet[];
  pending: Readonly<Record<string, number>>;
  created?: boolean;
}): number {
  const all = state.created === false;
  return state.sets.filter((s) => s.tracked && (all || s.exerciseId in state.pending)).length;
}

/**
 * Локальний підсумок зі стору — ті самі розрахунки, що на сервері
 * (buildWorkoutSummary). Історія вправ — та, що була в сторі на старті
 * (тобто ДО цього тренування). Порівняння з минулим таким днем недоступне
 * без мережі (previous: null).
 */
export function buildLocalSummary(
  state: { exercises: readonly WorkoutExercise[]; sets: readonly WorkoutSet[] },
  startedAt: string,
  finishedAt: string,
  nameOf: (exercise: WorkoutExercise) => string = (e) => e.name,
  unit: WeightUnit = "kg",
): WorkoutSummary {
  const order = new Map(state.exercises.map((e, i) => [e.exerciseId, i]));
  const sets = state.sets
    .filter((s) => s.isCompleted && s.weightKg !== null && order.has(s.exerciseId))
    .sort((a, b) => order.get(a.exerciseId)! - order.get(b.exerciseId)! || a.setNumber - b.setNumber)
    .map((s) => ({ exerciseId: s.exerciseId, weight: s.weightKg!, reps: s.reps, isCompleted: true }));

  return buildWorkoutSummary({
    startedAt,
    finishedAt,
    exercises: state.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: nameOf(e),
      muscleGroup: e.muscleGroup,
      repMin: e.repMin,
      repMax: e.repMax,
      targetSets: e.targetSets,
      increment: e.increment,
      equipment: e.equipment,
      history: e.history,
      best: e.best,
    })),
    sets,
    previous: null,
    unit,
  });
}

/** UUID v4; crypto.randomUUID є лише в захищеному контексті (https / localhost). */
export function newWorkoutId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
