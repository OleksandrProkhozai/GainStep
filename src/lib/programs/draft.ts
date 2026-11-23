/**
 * Локальна чернетка програми в редакторі: стан, редюсер, перестановка,
 * оцінка тривалості дня та побудова payload для RPC save_program.
 * Усе — чисті функції (без React і Supabase), тож покрито тестами.
 */

import type { Equipment, MuscleGroup } from "@/lib/exercises/catalog";
import { effectiveRest, TRANSITION_REST, transitionRest } from "@/lib/workout/rest";
import { PROGRAM_LIMITS as L, type SaveProgramPayload } from "./schema";

export interface DraftExercise {
  /** Стабільний ключ на клієнті (для React і drag & drop). */
  key: string;
  /** id рядка program_exercises; null — новий рядок. */
  id: string | null;
  exerciseId: string;
  name: string;
  /** Українська назва системної вправи; показ — через exerciseName(). */
  nameUk: string | null;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  /** Крок ваги вправи, кг. */
  incrementKg: number;
  /** Фото вправи (лише для показу мініатюри). */
  imagePath?: string | null;
  /** Власна вправа (мініатюра за замовчуванням — фото, а не група м'язів). */
  custom?: boolean;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /** Базова вправа (exercises.is_compound): авто-перехід 5:00 замість 3:00. */
  isCompound: boolean;
  /** Відпочинок після вправи (program_exercises.transition_rest_seconds); null — авто. */
  transitionRestSeconds: number | null;
}

export interface DraftDay {
  key: string;
  /** id рядка program_days; null — новий день. */
  id: string | null;
  name: string;
  exercises: DraftExercise[];
}

export interface ProgramDraft {
  name: string;
  days: DraftDay[];
}

/** Значення для вправи, доданої через picker: 3 × 8–12, відпочинок 1:30. */
export const NEW_EXERCISE_DEFAULTS = { targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90 } as const;

// ───────────── Перестановка ─────────────

/** Новий масив, де елемент з `from` перенесено на `to`. Невалідні індекси — без змін. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ───────────── Обмеження чисел ─────────────

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

/**
 * Застосовує зміну до вправи з урахуванням меж. min і max повторень
 * не перетинаються: якщо змінено min — він не може перевищити max, і навпаки.
 */
export function patchExercise(
  ex: DraftExercise,
  patch: Partial<Pick<DraftExercise, "targetSets" | "repMin" | "repMax" | "restSeconds" | "transitionRestSeconds">>,
): DraftExercise {
  const next = { ...ex };
  if (patch.targetSets !== undefined) next.targetSets = clamp(patch.targetSets, L.setsMin, L.setsMax);
  if (patch.repMin !== undefined) next.repMin = clamp(patch.repMin, L.repsMin, next.repMax);
  if (patch.repMax !== undefined) next.repMax = clamp(patch.repMax, next.repMin, L.repsMax);
  if (patch.restSeconds !== undefined) next.restSeconds = clamp(patch.restSeconds, L.restMin, L.restMax);
  // null — "Скинути на авто"; число — власне значення в межах 0:00–15:00.
  if (patch.transitionRestSeconds !== undefined) {
    next.transitionRestSeconds =
      patch.transitionRestSeconds === null
        ? null
        : clamp(patch.transitionRestSeconds, TRANSITION_REST.min, TRANSITION_REST.max);
  }
  return next;
}

// ───────────── Редюсер ─────────────

export type DraftAction =
  | { type: "reset"; draft: ProgramDraft }
  | { type: "rename"; name: string }
  | { type: "addDay"; key: string; name: string }
  | { type: "renameDay"; dayKey: string; name: string }
  | { type: "removeDay"; dayKey: string }
  | { type: "moveExercise"; dayKey: string; from: number; to: number }
  | {
      type: "updateExercise";
      dayKey: string;
      key: string;
      patch: Parameters<typeof patchExercise>[1];
    }
  | { type: "removeExercise"; dayKey: string; key: string }
  | { type: "addExercises"; dayKey: string; exercises: DraftExercise[] };

function mapDay(draft: ProgramDraft, dayKey: string, fn: (day: DraftDay) => DraftDay): ProgramDraft {
  return { ...draft, days: draft.days.map((d) => (d.key === dayKey ? fn(d) : d)) };
}

export function draftReducer(draft: ProgramDraft, action: DraftAction): ProgramDraft {
  switch (action.type) {
    case "reset":
      return action.draft;
    case "rename":
      return { ...draft, name: action.name };
    case "addDay":
      if (draft.days.length >= L.daysMax) return draft;
      return { ...draft, days: [...draft.days, { key: action.key, id: null, name: action.name, exercises: [] }] };
    case "renameDay":
      return mapDay(draft, action.dayKey, (d) => ({ ...d, name: action.name }));
    case "removeDay":
      // Останній день видалити не можна.
      if (draft.days.length <= L.daysMin) return draft;
      return { ...draft, days: draft.days.filter((d) => d.key !== action.dayKey) };
    case "moveExercise":
      return mapDay(draft, action.dayKey, (d) => ({ ...d, exercises: reorder(d.exercises, action.from, action.to) }));
    case "updateExercise":
      return mapDay(draft, action.dayKey, (d) => ({
        ...d,
        exercises: d.exercises.map((e) => (e.key === action.key ? patchExercise(e, action.patch) : e)),
      }));
    case "removeExercise":
      return mapDay(draft, action.dayKey, (d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== action.key) }));
    case "addExercises":
      return mapDay(draft, action.dayKey, (d) => {
        // Вправа не повторюється в межах дня.
        const present = new Set(d.exercises.map((e) => e.exerciseId));
        const fresh = action.exercises.filter((e) => !present.has(e.exerciseId) && present.add(e.exerciseId));
        return { ...d, exercises: [...d.exercises, ...fresh] };
      });
  }
}

/**
 * Назва для нового дня: "{word} N" ("Day 3" / "День 3"), де N — перший
 * вільний номер. word — перекладене слово "Day" з messages.
 */
export function nextDayName(days: readonly Pick<DraftDay, "name">[], word = "Day") {
  const names = new Set(days.map((d) => d.name.trim().toLocaleLowerCase()));
  let n = days.length + 1;
  while (names.has(`${word} ${n}`.toLocaleLowerCase())) n++;
  return `${word} ${n}`;
}

// ───────────── Payload і "незбережені зміни" ─────────────

/** Чернетка → payload RPC save_program (порядок масивів = position). */
export function buildSavePayload(draft: ProgramDraft): SaveProgramPayload {
  return {
    name: draft.name.trim(),
    days: draft.days.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      exercises: d.exercises.map((e) => ({
        id: e.id,
        exercise_id: e.exerciseId,
        target_sets: e.targetSets,
        rep_min: e.repMin,
        rep_max: e.repMax,
        rest_seconds: e.restSeconds,
        transition_rest_seconds: e.transitionRestSeconds,
      })),
    })),
  };
}

/** Чи відрізняється чернетка від збереженої версії (за змістом, без клієнтських ключів). */
export function isDraftDirty(saved: ProgramDraft, draft: ProgramDraft) {
  return JSON.stringify(buildSavePayload(saved)) !== JSON.stringify(buildSavePayload(draft));
}

/**
 * Опис змін для перевірки (і тестів): які дні та вправи нові,
 * змінені чи видалені відносно збереженої версії.
 */
export function describeChanges(saved: ProgramDraft, draft: ProgramDraft) {
  const savedPayload = buildSavePayload(saved);
  const nextPayload = buildSavePayload(draft);
  const savedDays = new Map(savedPayload.days.filter((d) => d.id).map((d, i) => [d.id!, { d, i }]));
  const nextDayIds = new Set(nextPayload.days.map((d) => d.id).filter(Boolean));
  const savedEx = new Map(
    savedPayload.days.flatMap((d) => d.exercises.map((e, i) => [e.id!, { e, i }] as const)).filter(([id]) => id),
  );
  const nextExIds = new Set(nextPayload.days.flatMap((d) => d.exercises.map((e) => e.id)).filter(Boolean));

  return {
    renamed: savedPayload.name !== nextPayload.name,
    addedDays: nextPayload.days.filter((d) => d.id === null).map((d) => d.name),
    removedDayIds: [...savedDays.keys()].filter((id) => !nextDayIds.has(id)),
    changedDayIds: nextPayload.days
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => {
        const prev = d.id ? savedDays.get(d.id) : undefined;
        return prev && (prev.d.name !== d.name || prev.i !== i);
      })
      .map(({ d }) => d.id!),
    addedExercises: nextPayload.days.flatMap((d) => d.exercises.filter((e) => e.id === null).map((e) => e.exercise_id)),
    removedExerciseIds: [...savedEx.keys()].filter((id) => !nextExIds.has(id)),
    changedExerciseIds: nextPayload.days.flatMap((d) =>
      d.exercises
        .map((e, i) => ({ e, i }))
        .filter(({ e, i }) => {
          const prev = e.id ? savedEx.get(e.id) : undefined;
          if (!prev) return false;
          const { e: p } = prev;
          return (
            prev.i !== i ||
            p.target_sets !== e.target_sets ||
            p.rep_min !== e.rep_min ||
            p.rep_max !== e.rep_max ||
            p.rest_seconds !== e.rest_seconds ||
            p.transition_rest_seconds !== e.transition_rest_seconds
          );
        })
        .map(({ e }) => e.id!),
    ),
  };
}

// ───────────── Зведення дня ─────────────

/** Секунд на сам підхід (до відпочинку) в оцінці тривалості. */
export const SET_WORK_SECONDS = 40;

/** Поля вправи, потрібні для оцінки тривалості. */
export type EstimateExercise = Pick<DraftExercise, "targetSets" | "restSeconds"> &
  Partial<Pick<DraftExercise, "isCompound" | "transitionRestSeconds">>;

/**
 * Орієнтовна тривалість дня, хв: сума по вправах
 * sets × (ефективний відпочинок + 40 с), округлена до 5 хв.
 * Ефективний відпочинок — effectiveRest(rest_seconds, мінімум з налаштувань).
 * З увімкненим перехідним відпочинком після останнього підходу кожної
 * вправи, КРІМ останньої, замість звичайного відпочинку — transitionRest().
 */
export function estimateDayMinutes(
  exercises: readonly EstimateExercise[],
  minRestSeconds = 0,
  transitionRestEnabled = false,
) {
  const settings = { minRestSeconds, transitionRestEnabled };
  const seconds = exercises.reduce((sum, e, i) => {
    const rest = effectiveRest(e.restSeconds, minRestSeconds);
    let total = sum + e.targetSets * (rest + SET_WORK_SECONDS);
    const transition = transitionRest(e, settings, i < exercises.length - 1);
    if (transition !== null) total += transition - rest;
    return total;
  }, 0);
  return Math.round(seconds / 60 / 5) * 5;
}

/** Зведення дня для рядка "5 exercises · 15 sets · ~40 min" (текст — у компоненті). */
export function dayStats(
  exercises: readonly EstimateExercise[],
  minRestSeconds = 0,
  transitionRestEnabled = false,
) {
  return {
    exercises: exercises.length,
    sets: exercises.reduce((s, e) => s + e.targetSets, 0),
    minutes: estimateDayMinutes(exercises, minRestSeconds, transitionRestEnabled),
  };
}

/** 90 → "1:30". */
export function formatRest(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "4 × 6–10" (або "4 × 8", якщо min = max). */
export function formatScheme(e: Pick<DraftExercise, "targetSets" | "repMin" | "repMax">) {
  return `${e.targetSets} × ${e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}`;
}
