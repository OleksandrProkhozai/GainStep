import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeightUnit } from "@/lib/units";
import type { Database } from "@/types/database.types";
import type { BodyWeightEntry } from "./body-weight";
import {
  buildExerciseHistories,
  personalRecords,
  weeklyVolume,
  type ExerciseHistory,
  type PersonalRecord,
  type ProgressSet,
  type WeekVolume,
} from "./derive";

type Client = SupabaseClient<Database>;

export type ProgressData = {
  unit: WeightUnit;
  exercises: ExerciseHistory[];
  records: PersonalRecord[];
  weeklyVolume: WeekVolume[];
  /** Від найстаршого до найновішого. */
  bodyWeight: BodyWeightEntry[];
};

/** PostgREST віддає щонайбільше 1000 рядків за запит — читаємо сторінками. */
const PAGE_SIZE = 1000;
/** Запобіжник: не більше 20 000 підходів (роки щоденних тренувань). */
const MAX_PAGES = 20;
const VOLUME_WEEKS = 8;

/**
 * Усі дані сторінки прогресу. Історію читаємо повністю (усі виконані
 * підходи завершених тренувань), щоб перемикання вправи й періоду
 * працювало на клієнті миттєво, без нових запитів.
 */
export async function getProgressData(
  supabase: Client,
  userId: string,
  now = new Date(),
): Promise<ProgressData> {
  const [profileRes, bodyWeight, sets] = await Promise.all([
    supabase.from("profiles").select("unit").eq("id", userId).maybeSingle(),
    getBodyWeightEntries(supabase, userId),
    getAllCompletedSets(supabase, userId),
  ]);
  if (profileRes.error) throw profileRes.error;

  const exercises = buildExerciseHistories(sets);

  return {
    unit: profileRes.data?.unit ?? "kg",
    exercises,
    records: personalRecords(exercises),
    weeklyVolume: weeklyVolume(sets, now, VOLUME_WEEKS),
    bodyWeight,
  };
}

/** Усі записи ваги тіла (один на день), від старих до нових. */
async function getBodyWeightEntries(supabase: Client, userId: string): Promise<BodyWeightEntry[]> {
  const result: BodyWeightEntry[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("body_weight_entries")
      .select("weight, recorded_on")
      .eq("user_id", userId)
      .order("recorded_on", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const e of data) result.push({ date: e.recorded_on, weightKg: Number(e.weight) });
    if (data.length < PAGE_SIZE) break;
  }
  return result;
}

async function getAllCompletedSets(supabase: Client, userId: string): Promise<ProgressSet[]> {
  const result: ProgressSet[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("workout_sets")
      .select(
        "id, weight, reps, exercise_id, workout_id, exercises ( name ), workouts!inner ( started_at, status, user_id )",
      )
      .eq("is_completed", true)
      .eq("workouts.status", "completed")
      .eq("workouts.user_id", userId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    for (const s of data) {
      result.push({
        exerciseId: s.exercise_id,
        exerciseName: s.exercises?.name ?? "Exercise",
        workoutId: s.workout_id,
        startedAt: s.workouts.started_at,
        weight: Number(s.weight),
        reps: s.reps,
      });
    }
    if (data.length < PAGE_SIZE) break;
  }
  return result;
}
