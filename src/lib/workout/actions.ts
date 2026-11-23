"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { saveProgramSchema } from "@/lib/programs/schema";
import {
  applyChangesToDay,
  exercisePlanSchema,
  hasPlanChanges,
  parsePlan,
  planChanges,
  planFromDay,
} from "./plan";

/** error — код повідомлення (errors.*); текст підставляє клієнт. */
export type WorkoutActionResult = { error: string };

const idSchema = z.guid();
const notesSchema = z.string().max(2000);

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/**
 * Старт тренування за днем програми. Якщо вже є незавершене тренування —
 * продовжуємо його (одночасно активне лише одне), інакше створюємо нове.
 * Друге значення — FormData, коли дія підключена через <form action>.
 */
export async function startWorkout(programDayId: string, _formData?: FormData) {
  void _formData;
  const { supabase, userId } = await requireUser();

  const { data: active, error: activeError } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;
  if (active) redirect(`/workout/${active.id}`);

  if (!idSchema.safeParse(programDayId).success) redirect("/");

  // RLS поверне день лише з власної програми або шаблону.
  const { data: day, error: dayError } = await supabase
    .from("program_days")
    .select("id, name, program_exercises ( position, exercise_id, target_sets, rep_min, rep_max, rest_seconds )")
    .eq("id", programDayId)
    .maybeSingle();
  if (dayError) throw dayError;
  if (!day) redirect("/");

  const { data: workout, error } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      name: day.name,
      program_day_id: day.id,
      status: "in_progress",
      // Склад тренування — з дня програми; далі змінюється під час тренування.
      exercise_plan: planFromDay([...day.program_exercises].sort((a, b) => a.position - b.position)),
    })
    .select("id")
    .single();
  if (error) throw error;

  redirect(`/workout/${workout.id}`);
}

/**
 * Завершення тренування. Клієнт викликає дію лише після того, як
 * відправив чергу підходів. Невиконані підходи видаляються — в історію
 * (і в алгоритм прогресії) потрапляють лише виконані.
 */
export async function finishWorkout(
  workoutId: string,
  notes: string,
): Promise<WorkoutActionResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { error: "workoutNotFound" };
  const parsedNotes = notesSchema.safeParse(notes.trim());
  if (!parsedNotes.success) return { error: "notesTooLong" };

  const { data: workout, error: loadError } = await supabase
    .from("workouts")
    .select("id, status")
    .eq("id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) {
    console.error("finishWorkout: load", loadError);
    return { error: "workoutFinishFailed" };
  }
  if (!workout) return { error: "workoutNotFound" };

  if (workout.status === "in_progress") {
    const { error: deleteError } = await supabase
      .from("workout_sets")
      .delete()
      .eq("workout_id", workoutId)
      .eq("is_completed", false);
    if (deleteError) {
      console.error("finishWorkout: delete sets", deleteError);
      return { error: "workoutFinishFailed" };
    }

    const { error: updateError } = await supabase
      .from("workouts")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        notes: parsedNotes.data || null,
      })
      .eq("id", workoutId);
    if (updateError) {
      console.error("finishWorkout: update", updateError);
      return { error: "workoutFinishFailed" };
    }
  }

  revalidatePath("/");
  revalidatePath("/workouts");
  revalidatePath("/progress");
  redirect(`/workout/${workoutId}/summary`);
}

export type NotesActionResult = { ok: true; notes: string } | { ok: false; error: string };

/** Редагування нотатки завершеного тренування (екран підсумку). */
export async function updateWorkoutNotes(
  workoutId: string,
  notes: string,
): Promise<NotesActionResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { ok: false, error: "workoutNotFound" };
  const parsed = notesSchema.safeParse(typeof notes === "string" ? notes.trim() : "");
  if (!parsed.success) return { ok: false, error: "notesTooLong" };

  const { data, error } = await supabase
    .from("workouts")
    .update({ notes: parsed.data || null })
    .eq("id", workoutId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .select("id");
  if (error) {
    console.error("updateWorkoutNotes", error);
    return { ok: false, error: "noteSaveFailed" };
  }
  if (data.length === 0) return { ok: false, error: "workoutNotFound" };

  revalidatePath(`/workout/${workoutId}/summary`);
  return { ok: true, notes: parsed.data };
}

/**
 * Скасування тренування: видаляє його разом з підходами (on delete cascade).
 * redirectTo — лише з білого списку (екран тренування → "/", хаб → "/workouts").
 */
export async function discardWorkout(
  workoutId: string,
  redirectTo: "/" | "/workouts" = "/",
): Promise<WorkoutActionResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { error: "workoutNotFound" };

  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) {
    console.error("discardWorkout", error);
    return { error: "workoutDiscardFailed" };
  }

  const target = redirectTo === "/workouts" ? "/workouts" : "/";
  revalidatePath("/");
  revalidatePath("/workouts");
  redirect(target);
}

export type PlanActionResult = { ok: true } | { ok: false; error: string };

/**
 * Склад активного тренування (додали / прибрали вправу). Викликає черга
 * синхронізації (sync.ts) — повторна відправка того самого складу безпечна.
 * Завершене тренування не змінюємо, але й не вважаємо це помилкою:
 * інакше черга повторювала б запит без кінця.
 */
export async function saveExercisePlan(workoutId: string, plan: unknown): Promise<PlanActionResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { ok: false, error: "workoutNotFound" };
  const parsed = exercisePlanSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, error: "workoutPlanInvalid" };

  const { error } = await supabase
    .from("workouts")
    .update({ exercise_plan: parsed.data })
    .eq("id", workoutId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) {
    console.error("saveExercisePlan", error);
    return { ok: false, error: "workoutPlanSaveFailed" };
  }
  return { ok: true };
}

/**
 * «Оновити день у програмі» з екрана підсумку: додані під час тренування
 * вправи — у кінець дня, прибрані — з дня. Зміни рахуються тут заново
 * (клієнту не довіряємо), зберігається вся програма через save_program
 * (одна транзакція). Лише власні програми — шаблони не змінюються.
 */
export async function applyWorkoutChangesToProgram(workoutId: string): Promise<PlanActionResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { ok: false, error: "workoutNotFound" };

  const { data: workout, error: loadError } = await supabase
    .from("workouts")
    .select(
      `id, status, exercise_plan, program_day_id,
       program_day:program_days ( id, program:programs ( id, name, owner_id,
         program_days ( id, name, position,
           program_exercises ( id, position, exercise_id, target_sets, rep_min, rep_max, rest_seconds, transition_rest_seconds ) ) ) )`,
    )
    .eq("id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) {
    console.error("applyWorkoutChangesToProgram: load", loadError);
    return { ok: false, error: "programSaveFailed" };
  }
  const program = workout?.program_day?.program;
  if (!workout || workout.status !== "completed" || !program) return { ok: false, error: "workoutNotFound" };
  if (program.owner_id !== userId) return { ok: false, error: "programNotFound" };

  const days = [...program.program_days].sort((a, b) => a.position - b.position);
  const toPayloadExercises = (d: (typeof days)[number]) =>
    [...d.program_exercises]
      .sort((a, b) => a.position - b.position)
      .map((pe) => ({
        id: pe.id,
        exercise_id: pe.exercise_id,
        target_sets: pe.target_sets,
        rep_min: pe.rep_min,
        rep_max: pe.rep_max,
        rest_seconds: pe.rest_seconds,
        transition_rest_seconds: pe.transition_rest_seconds,
      }));

  const day = days.find((d) => d.id === workout.program_day_id);
  if (!day) return { ok: false, error: "programNotFound" };
  const current = toPayloadExercises(day);
  const changes = planChanges(
    parsePlan(workout.exercise_plan),
    current.map((e) => e.exercise_id),
  );
  // Уже оновлено (або змін не було) — нічого не робимо.
  if (!hasPlanChanges(changes)) return { ok: true };

  const parsed = saveProgramSchema.safeParse({
    name: program.name,
    days: days.map((d) => ({
      id: d.id,
      name: d.name,
      exercises: d.id === day.id ? applyChangesToDay(current, changes) : toPayloadExercises(d),
    })),
  });
  if (!parsed.success) {
    console.error("applyWorkoutChangesToProgram: payload", parsed.error.issues[0]);
    return { ok: false, error: "programInvalid" };
  }

  const { error } = await supabase.rpc("save_program", { p_program_id: program.id, p_payload: parsed.data });
  if (error) {
    console.error("applyWorkoutChangesToProgram: save", error);
    return { ok: false, error: error.code === "P0002" ? "programNotFound" : "programSaveFailed" };
  }

  revalidatePath("/programs");
  revalidatePath(`/programs/${program.id}`);
  revalidatePath("/");
  revalidatePath("/workouts");
  revalidatePath(`/workout/${workoutId}/summary`);
  return { ok: true };
}
