"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "@/lib/validations/zod-codes";
import { createClient } from "@/lib/supabase/server";
import { fromDisplayWeight } from "@/lib/units";
import { toLibraryExercise } from "@/lib/programs/queries";
import { EXERCISE_LIMITS, exerciseFormSchema, type ExerciseFormInput, type LibraryExercise } from "./catalog";

/** error — код (errors.*), текст підставляє клієнт. */
export type ExerciseResult = { ok: true; exercise: LibraryExercise } | { ok: false; error: string };
export type DeleteExerciseResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();
const COLUMNS = "id, name, name_uk, muscle_group, equipment, weight_increment, owner_id";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

function revalidateExercises() {
  revalidatePath("/exercises");
  revalidatePath("/programs", "layout");
}

/** Поля форми → рядок exercises. Крок вводиться в одиницях користувача, у базу — кг. */
function toRow(input: ExerciseFormInput) {
  const kg = Math.round(fromDisplayWeight(input.weightStep, input.unit) * 100) / 100;
  if (kg <= 0 || kg > EXERCISE_LIMITS.stepMaxKg) return null;
  return {
    name: input.name,
    muscle_group: input.muscleGroup,
    equipment: input.equipment,
    weight_increment: kg,
  };
}

function writeError(error: { code?: string }, action: string) {
  if (error.code === "23505") return "exerciseExists";
  console.error(action, error);
  return "exerciseSaveFailed";
}

export async function createExercise(input: ExerciseFormInput): Promise<ExerciseResult> {
  const { supabase, userId } = await requireUser();
  const parsed = exerciseFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalidForm" };
  const row = toRow(parsed.data);
  if (!row) return { ok: false, error: "weightStepUnrealistic" };

  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...row, owner_id: userId })
    .select(COLUMNS)
    .single();
  if (error) return { ok: false, error: writeError(error, "createExercise") };

  revalidateExercises();
  return { ok: true, exercise: toLibraryExercise(data) };
}

export async function updateExercise(id: string, input: ExerciseFormInput): Promise<ExerciseResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "exerciseNotFound" };
  const parsed = exerciseFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalidForm" };
  const row = toRow(parsed.data);
  if (!row) return { ok: false, error: "weightStepUnrealistic" };

  const { data, error } = await supabase
    .from("exercises")
    .update(row)
    .eq("id", id)
    .eq("owner_id", userId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: writeError(error, "updateExercise") };
  if (!data) return { ok: false, error: "exerciseNotFound" };

  revalidateExercises();
  return { ok: true, exercise: toLibraryExercise(data) };
}

const IN_USE = "exerciseInUse";

/**
 * Видалення власної вправи. Якщо вона є в програмі чи в історії,
 * видалення блокується (і в базі: on delete restrict) — повідомляємо зрозуміло.
 */
export async function deleteExercise(id: string): Promise<DeleteExerciseResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "exerciseNotFound" };

  const [inPrograms, inHistory] = await Promise.all([
    supabase.from("program_exercises").select("id", { count: "exact", head: true }).eq("exercise_id", id),
    supabase.from("workout_sets").select("id", { count: "exact", head: true }).eq("exercise_id", id),
  ]);
  if (inPrograms.error || inHistory.error) {
    console.error("deleteExercise: usage", inPrograms.error ?? inHistory.error);
    return { ok: false, error: "exerciseDeleteFailed" };
  }
  if ((inPrograms.count ?? 0) > 0 || (inHistory.count ?? 0) > 0) return { ok: false, error: IN_USE };

  const { data, error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId)
    .select("id");
  if (error) {
    if (error.code === "23503") return { ok: false, error: IN_USE };
    console.error("deleteExercise", error);
    return { ok: false, error: "exerciseDeleteFailed" };
  }
  if (data.length === 0) return { ok: false, error: "exerciseNotFound" };

  revalidateExercises();
  return { ok: true };
}
