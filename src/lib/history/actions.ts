"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { editWorkoutSchema, firstIssueCode, type EditWorkoutInput } from "./edit-schema";

export type HistoryActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/**
 * Усе, що залежить від історії тренувань: історія, сторінка тренування,
 * дашборд, прогрес і програми (підказки "Наступного разу" рахуються з історії).
 */
function revalidateHistory(workoutId: string) {
  revalidatePath("/workouts", "layout");
  revalidatePath(`/workout/${workoutId}/summary`);
  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath("/programs", "layout");
}

/**
 * Збереження відредагованого тренування — атомарно через RPC
 * save_workout_sets (видалення й вставка підходів, нотатка, час — в одній
 * транзакції). Вага приходить уже в кг.
 */
export async function saveWorkoutEdits(input: EditWorkoutInput): Promise<HistoryActionResult> {
  const parsed = editWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueCode(parsed.error) };
  const { workoutId, exercises, notes, startedAt } = parsed.data;
  if (Date.parse(startedAt) > Date.now()) return { ok: false, error: "workoutStartFuture" };

  const { supabase } = await requireUser();
  const sets = exercises.flatMap((ex) =>
    ex.sets.map((s) => ({
      exercise_id: ex.exerciseId,
      weight: Math.round(s.weightKg * 100) / 100,
      reps: s.reps,
      is_completed: s.isCompleted,
      completed_at: s.isCompleted ? s.completedAt : null,
    })),
  );

  const { error } = await supabase.rpc("save_workout_sets", {
    p_workout_id: workoutId,
    p_sets: sets,
    p_notes: notes,
    p_started_at: new Date(startedAt).toISOString(),
  });
  if (error) {
    console.error("saveWorkoutEdits", error);
    // 42883 / PGRST202 — функції ще немає (міграцію не застосовано).
    if (error.code === "42883" || error.code === "PGRST202") return { ok: false, error: "workoutEditNotSetUp" };
    if (error.code === "P0002") return { ok: false, error: "workoutNotFound" };
    return { ok: false, error: "workoutSaveFailed" };
  }

  revalidateHistory(workoutId);
  return { ok: true };
}

/** Видалення завершеного тренування (підходи — каскадом). */
export async function deleteWorkout(workoutId: string): Promise<HistoryActionResult> {
  if (!z.guid().safeParse(workoutId).success) return { ok: false, error: "workoutNotFound" };
  const { supabase, userId } = await requireUser();

  const { data, error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .select("id");
  if (error) {
    console.error("deleteWorkout", error);
    return { ok: false, error: "workoutDeleteFailed" };
  }
  if (data.length === 0) return { ok: false, error: "workoutNotFound" };

  revalidateHistory(workoutId);
  return { ok: true };
}
