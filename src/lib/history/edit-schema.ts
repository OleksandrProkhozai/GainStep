/**
 * Редагування завершеного тренування: схема zod (сервер, вага в кг) і
 * розбір чернетки форми (клієнт, вага в одиницях користувача).
 * Межі — як у CHECK-обмеженнях бази: reps 0–100, weight ≥ 0 (numeric(6,2));
 * верхня межа ваги — та сама, що й на екрані тренування (WEIGHT_MAX_KG).
 */

import { z } from "@/lib/validations/zod-codes";
import { inputToKg, kgToUnit, type WeightUnit } from "@/lib/units";
import { REPS_MAX, WEIGHT_MAX_KG } from "@/lib/workout/derive";

export const NOTES_MAX = 2000;

const setSchema = z.object({
  weightKg: z.number().min(0, "editWeightRange").max(WEIGHT_MAX_KG, "editWeightRange"),
  reps: z.number().int("editRepsRange").min(0, "editRepsRange").max(REPS_MAX, "editRepsRange"),
  isCompleted: z.boolean(),
  completedAt: z.string().nullable(),
});

export const editWorkoutSchema = z.object({
  workoutId: z.guid(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.guid(),
        sets: z.array(setSchema).min(1, "exerciseNeedsSet"),
      }),
    )
    .min(1, "workoutNeedsExercise"),
  notes: z.string().trim().max(NOTES_MAX, "notesTooLong"),
  startedAt: z.iso.datetime({ offset: true, error: "dateInvalid" }),
});

export type EditWorkoutInput = z.infer<typeof editWorkoutSchema>;

/** Перший код помилки схеми (для toast). */
export function firstIssueCode(error: z.ZodError) {
  return error.issues[0]?.message ?? "invalidForm";
}

// ───────────── Чернетка форми (клієнт) ─────────────

export interface DraftSet {
  key: string;
  /** Текст поля ваги в одиницях користувача ("62,5" / "62.5"). */
  weight: string;
  reps: string;
  isCompleted: boolean;
  completedAt: string | null;
  /** Вага в базі до редагування — щоб 62.5 кг ↔ 138 lb не дрейфувало. */
  originalKg: number | null;
}

export interface DraftExercise {
  exerciseId: string;
  sets: DraftSet[];
}

export interface EditDraft {
  exercises: DraftExercise[];
  notes: string;
  /** "YYYY-MM-DD" і "HH:mm" у поясі користувача. */
  date: string;
  time: string;
}

/** Помилки по полях: "<setKey>.weight" | "<setKey>.reps" | "<exerciseId>.sets" | "notes" | "date". */
export type DraftErrors = Record<string, string>;

/** "62,5" → 62.5; порожньо або не число → NaN. */
export function parseDecimal(text: string) {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "" || !/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

/**
 * Перевіряє чернетку і переводить вагу в кг. Повертає або готові дані
 * для server action (без workoutId і startedAt), або помилки по полях.
 * Дата в майбутньому перевіряється окремо (залежить від "зараз").
 */
export function parseEditDraft(
  draft: EditDraft,
  unit: WeightUnit,
):
  | { ok: true; value: Omit<EditWorkoutInput, "workoutId" | "startedAt"> }
  | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const maxInUnit = kgToUnit(WEIGHT_MAX_KG, unit);

  const exercises = draft.exercises.map((ex) => {
    if (ex.sets.length === 0) errors[`${ex.exerciseId}.sets`] = "exerciseNeedsSet";
    return {
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s) => {
        const weight = parseDecimal(s.weight);
        if (!Number.isFinite(weight) || weight < 0 || weight > maxInUnit + 1e-9) {
          errors[`${s.key}.weight`] = "editWeightRange";
        }
        const repsText = s.reps.trim();
        const reps = /^\d+$/.test(repsText) ? Number(repsText) : Number.NaN;
        if (!Number.isInteger(reps) || reps < 0 || reps > REPS_MAX) errors[`${s.key}.reps`] = "editRepsRange";
        return {
          weightKg: Number.isFinite(weight) ? Math.min(WEIGHT_MAX_KG, inputToKg(weight, unit, s.originalKg)) : 0,
          reps: Number.isFinite(reps) ? reps : 0,
          isCompleted: s.isCompleted,
          completedAt: s.completedAt,
        };
      }),
    };
  });

  if (draft.exercises.length === 0) errors.exercises = "workoutNeedsExercise";
  if (draft.notes.trim().length > NOTES_MAX) errors.notes = "notesTooLong";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time)) errors.date = "dateInvalid";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { exercises, notes: draft.notes.trim() } };
}
