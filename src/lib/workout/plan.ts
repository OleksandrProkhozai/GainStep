/**
 * Склад тренування (workouts.exercise_plan) — чисті функції без Supabase і React.
 *
 * Склад може відрізнятися від дня програми: під час тренування вправи
 * додають і прибирають. Тому він зберігається разом із тренуванням
 * (jsonb-масив PlanItem), а не лише в localStorage.
 */

import { z } from "zod";
import { ADDED_EXERCISE_DEFAULTS, type WorkoutExercise } from "./types";

export type PlanSource = "program" | "added";

/** Елемент workouts.exercise_plan (snake_case — як у базі). */
export type PlanItem = {
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  source: PlanSource;
};

/** Межі — як у CHECK-обмеженнях program_exercises (rest до 900 с). */
export const PLAN_LIMITS = { min: 1, max: 40 } as const;

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const planItemSchema = z
  .object({
    exercise_id: z.guid(),
    target_sets: int(1, 10),
    rep_min: int(1, 100),
    rep_max: int(1, 100),
    rest_seconds: int(0, 900),
    source: z.enum(["program", "added"]),
  })
  .refine((e) => e.rep_min <= e.rep_max);

export const exercisePlanSchema = z
  .array(planItemSchema)
  .min(PLAN_LIMITS.min)
  .max(PLAN_LIMITS.max)
  .refine((list) => new Set(list.map((e) => e.exercise_id)).size === list.length);

/** exercise_plan з бази → масив або null (стара / пошкоджена форма — null). */
export function parsePlan(value: unknown): PlanItem[] | null {
  const parsed = exercisePlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Рядок program_exercises (поля, потрібні складу). */
export interface DayExerciseParams {
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
}

/** Склад на старті тренування — з дня програми (у порядку position). */
export function planFromDay(dayExercises: readonly DayExerciseParams[]): PlanItem[] {
  const seen = new Set<string>();
  const plan: PlanItem[] = [];
  for (const pe of dayExercises) {
    if (seen.has(pe.exercise_id)) continue;
    seen.add(pe.exercise_id);
    plan.push({
      exercise_id: pe.exercise_id,
      target_sets: pe.target_sets,
      rep_min: pe.rep_min,
      rep_max: pe.rep_max,
      rest_seconds: pe.rest_seconds,
      source: "program",
    });
  }
  return plan;
}

/** Склад зі стору (вправи без поля source — старі стани — вважаються "program"). */
export function planFromExercises(exercises: readonly WorkoutExercise[]): PlanItem[] {
  return exercises.map((e) => ({
    exercise_id: e.exerciseId,
    target_sets: e.targetSets,
    rep_min: e.repMin,
    rep_max: e.repMax,
    rest_seconds: e.restSeconds,
    source: e.source ?? "program",
  }));
}

/**
 * Параметри прогресії вправи завершеного тренування: спершу склад
 * тренування, далі день програми, інакше — значення для доданої вправи.
 */
export function progressionParams(
  plan: readonly PlanItem[] | null,
  dayExercises: readonly Pick<DayExerciseParams, "exercise_id" | "target_sets" | "rep_min" | "rep_max">[],
) {
  const fromPlan = new Map((plan ?? []).map((p) => [p.exercise_id, p]));
  const fromDay = new Map(dayExercises.map((pe) => [pe.exercise_id, pe]));
  return (exerciseId: string) => {
    const p = fromPlan.get(exerciseId) ?? fromDay.get(exerciseId);
    return {
      targetSets: p?.target_sets ?? ADDED_EXERCISE_DEFAULTS.targetSets,
      repMin: p?.rep_min ?? ADDED_EXERCISE_DEFAULTS.repMin,
      repMax: p?.rep_max ?? ADDED_EXERCISE_DEFAULTS.repMax,
    };
  };
}

// ───────────── Додавання / видалення ─────────────

export type AddPlacement = "afterCurrent" | "end";

type Keyed = { exerciseId: string };

/**
 * Вставка вправ у склад: після поточної (за замовчуванням) або в кінець.
 * Вправи, що вже є в складі, пропускаються (одна вправа — один раз).
 * Повертає новий список і індекс, на який зсувається поточна вправа.
 */
export function insertExercises<T extends Keyed>(
  list: readonly T[],
  items: readonly T[],
  currentIndex: number,
  placement: AddPlacement,
): { list: T[]; added: T[]; currentIndex: number } {
  const taken = new Set(list.map((e) => e.exerciseId));
  const added: T[] = [];
  for (const item of items) {
    if (taken.has(item.exerciseId)) continue;
    taken.add(item.exerciseId);
    added.push(item);
  }
  if (added.length === 0) return { list: [...list], added, currentIndex };
  const current = Math.min(Math.max(0, currentIndex), Math.max(0, list.length - 1));
  const at = placement === "end" || list.length === 0 ? list.length : current + 1;
  return {
    list: [...list.slice(0, at), ...added, ...list.slice(at)],
    added,
    // Вставка завжди після поточної — її індекс не змінюється.
    currentIndex: current,
  };
}

/**
 * Прибирання вправи. null — вправи немає або вона остання (тренування
 * без вправ не буває). removedIndex — для undo.
 */
export function removeExercise<T extends Keyed>(
  list: readonly T[],
  exerciseId: string,
): { list: T[]; removed: T; removedIndex: number } | null {
  const removedIndex = list.findIndex((e) => e.exerciseId === exerciseId);
  if (removedIndex === -1 || list.length <= 1) return null;
  return {
    list: list.filter((_, i) => i !== removedIndex),
    removed: list[removedIndex],
    removedIndex,
  };
}

/** Чи можна прибрати вправу (не остання і є в складі). */
export function canRemoveExercise(list: readonly Keyed[], exerciseId: string) {
  return list.length > 1 && list.some((e) => e.exerciseId === exerciseId);
}

/**
 * Поточна вправа після прибирання:
 *  - прибрали вправу перед поточною — індекс зсувається на 1 назад;
 *  - прибрали поточну — фокус на наступну (той самий індекс), а якщо
 *    поточна була останньою — на попередню;
 *  - прибрали після поточної — без змін.
 */
export function indexAfterRemoval(currentIndex: number, removedIndex: number, newLength: number) {
  const next = removedIndex < currentIndex ? currentIndex - 1 : currentIndex;
  return Math.min(Math.max(0, next), Math.max(0, newLength - 1));
}

/** Undo: повертає вправу на її колишнє місце (або в кінець, якщо список скоротився). */
export function restoreExercise<T extends Keyed>(list: readonly T[], item: T, index: number): T[] {
  if (list.some((e) => e.exerciseId === item.exerciseId)) return [...list];
  const at = Math.min(Math.max(0, index), list.length);
  return [...list.slice(0, at), item, ...list.slice(at)];
}

/** Поточний індекс після undo: якщо вправу повернули перед поточною — зсув уперед. */
export function indexAfterRestore(currentIndex: number, restoredIndex: number) {
  return restoredIndex <= currentIndex ? currentIndex + 1 : currentIndex;
}

// ───────────── Зміни відносно дня програми ─────────────

export interface PlanChanges {
  /** Додані під час тренування вправи, яких немає в дні (у порядку складу). */
  added: PlanItem[];
  /** Вправи дня, яких у складі тренування немає (у порядку дня). */
  removed: string[];
}

/**
 * Що змінилося в складі тренування порівняно з днем програми.
 * Порівнюємо з ПОТОЧНИМ станом дня: якщо день уже оновили — змін немає.
 * Склад null (старі тренування) — змін немає.
 */
export function planChanges(
  plan: readonly PlanItem[] | null,
  dayExerciseIds: readonly string[],
): PlanChanges {
  if (!plan) return { added: [], removed: [] };
  const day = new Set(dayExerciseIds);
  const inPlan = new Set(plan.map((p) => p.exercise_id));
  return {
    added: plan.filter((p) => p.source === "added" && !day.has(p.exercise_id)),
    removed: dayExerciseIds.filter((id, i) => !inPlan.has(id) && dayExerciseIds.indexOf(id) === i),
  };
}

export const hasPlanChanges = (c: PlanChanges) => c.added.length > 0 || c.removed.length > 0;

/** Вправа дня в payload save_program. */
export interface SaveDayExercise {
  id: string | null;
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  transition_rest_seconds: number | null;
}

/**
 * Новий склад дня програми: прибрані вправи видаляються, додані —
 * дописуються в кінець дня (новими рядками, id = null) з параметрами з тренування.
 */
export function applyChangesToDay(
  dayExercises: readonly SaveDayExercise[],
  changes: PlanChanges,
): SaveDayExercise[] {
  const removed = new Set(changes.removed);
  const kept = dayExercises.filter((e) => !removed.has(e.exercise_id));
  const present = new Set(kept.map((e) => e.exercise_id));
  const appended = changes.added
    .filter((p) => !present.has(p.exercise_id))
    .map((p) => ({
      id: null,
      exercise_id: p.exercise_id,
      target_sets: p.target_sets,
      rep_min: p.rep_min,
      rep_max: p.rep_max,
      // Редактор програм дозволяє до 600 с.
      rest_seconds: Math.min(p.rest_seconds, 600),
      transition_rest_seconds: null,
    }));
  return [...kept, ...appended];
}
