"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type WorkoutActionResult = { error: string };

const idSchema = z.uuid();
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
    .select("id, name")
    .eq("id", programDayId)
    .maybeSingle();
  if (dayError) throw dayError;
  if (!day) redirect("/");

  const { data: workout, error } = await supabase
    .from("workouts")
    .insert({ user_id: userId, name: day.name, program_day_id: day.id, status: "in_progress" })
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
  if (!idSchema.safeParse(workoutId).success) return { error: "Workout not found" };
  const parsedNotes = notesSchema.safeParse(notes.trim());
  if (!parsedNotes.success) return { error: "Notes are too long (max 2000 characters)" };

  const { data: workout, error: loadError } = await supabase
    .from("workouts")
    .select("id, status")
    .eq("id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) {
    console.error("finishWorkout: load", loadError);
    return { error: "Couldn't finish the workout. Please try again." };
  }
  if (!workout) return { error: "Workout not found" };

  if (workout.status === "in_progress") {
    const { error: deleteError } = await supabase
      .from("workout_sets")
      .delete()
      .eq("workout_id", workoutId)
      .eq("is_completed", false);
    if (deleteError) {
      console.error("finishWorkout: delete sets", deleteError);
      return { error: "Couldn't finish the workout. Please try again." };
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
      return { error: "Couldn't finish the workout. Please try again." };
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
  if (!idSchema.safeParse(workoutId).success) return { ok: false, error: "Workout not found" };
  const parsed = notesSchema.safeParse(typeof notes === "string" ? notes.trim() : "");
  if (!parsed.success) return { ok: false, error: "Notes are too long (max 2000 characters)" };

  const { data, error } = await supabase
    .from("workouts")
    .update({ notes: parsed.data || null })
    .eq("id", workoutId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .select("id");
  if (error) {
    console.error("updateWorkoutNotes", error);
    return { ok: false, error: "Couldn't save the note. Please try again." };
  }
  if (data.length === 0) return { ok: false, error: "Workout not found" };

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
  if (!idSchema.safeParse(workoutId).success) return { error: "Workout not found" };

  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) {
    console.error("discardWorkout", error);
    return { error: "Couldn't discard the workout. Please try again." };
  }

  const target = redirectTo === "/workouts" ? "/workouts" : "/";
  revalidatePath("/");
  revalidatePath("/workouts");
  redirect(target);
}
