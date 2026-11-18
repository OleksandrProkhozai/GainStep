import type { SupabaseClient } from "@supabase/supabase-js";
import { pickNextDay } from "@/lib/dashboard/queries";
import type { WeightUnit } from "@/lib/units";
import type { Database } from "@/types/database.types";
import { loadExerciseHistory } from "./queries";
import { buildWorkoutSummary, type SummaryExerciseInput, type WorkoutSummary } from "./summary";
import { ADDED_EXERCISE_DEFAULTS } from "./types";

type Client = SupabaseClient<Database>;

/** Скільки назв вправ показуємо на картці "Next up". */
const NEXT_UP_PREVIEW = 3;

export type NextUp = { name: string; preview: string[]; more: number };

export type SummaryPageData = {
  workoutId: string;
  name: string;
  programName: string | null;
  /** Назва дня програми (для "vs last Push"); null — тренування не з програми. */
  dayName: string | null;
  startedAt: string;
  notes: string;
  unit: WeightUnit;
  summary: WorkoutSummary;
  nextUp: NextUp | null;
};

export type LoadSummaryResult =
  | { kind: "ok"; data: SummaryPageData }
  | { kind: "not-found" }
  | { kind: "in-progress" };

/**
 * Дані екрана підсумку. Дві хвилі запитів:
 *  1) тренування з днем і програмою, профіль (одиниці), підходи тренування;
 *  2) історія вправ ДО цього тренування (одним запитом) + попереднє
 *     завершене тренування того самого дня (для порівняння тоннажу).
 * Історія обмежена тренуваннями, що почалися не пізніше за це, тож
 * старий підсумок показує рекомендацію, актуальну на той момент.
 */
export async function loadWorkoutSummary(
  supabase: Client,
  workoutId: string,
  userId: string,
): Promise<LoadSummaryResult> {
  const [workoutRes, profileRes, setsRes] = await Promise.all([
    supabase
      .from("workouts")
      .select(
        `id, name, status, started_at, finished_at, notes, program_day_id,
         program_day:program_days (
           name,
           program_exercises ( exercise_id, target_sets, rep_min, rep_max ),
           program:programs (
             name,
             program_days ( id, name, position,
               program_exercises ( position, exercises ( name ) ) )
           )
         )`,
      )
      .eq("id", workoutId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("unit").eq("id", userId).maybeSingle(),
    supabase
      .from("workout_sets")
      .select(
        "exercise_id, exercise_position, set_number, weight, reps, is_completed, exercise:exercises ( id, name, weight_increment )",
      )
      .eq("workout_id", workoutId)
      .order("exercise_position")
      .order("set_number"),
  ]);
  if (workoutRes.error) throw workoutRes.error;
  if (profileRes.error) throw profileRes.error;
  if (setsRes.error) throw setsRes.error;

  const workout = workoutRes.data;
  if (!workout) return { kind: "not-found" };
  if (workout.status !== "completed") return { kind: "in-progress" };

  const day = workout.program_day;
  const paramsById = new Map((day?.program_exercises ?? []).map((pe) => [pe.exercise_id, pe]));

  // Вправи в порядку виконання (exercise_position), кожна — один раз.
  const exercises: Omit<SummaryExerciseInput, "history" | "best">[] = [];
  const seen = new Set<string>();
  for (const s of setsRes.data) {
    if (!s.exercise || seen.has(s.exercise_id)) continue;
    seen.add(s.exercise_id);
    const pe = paramsById.get(s.exercise_id);
    exercises.push({
      exerciseId: s.exercise_id,
      name: s.exercise.name,
      repMin: pe?.rep_min ?? ADDED_EXERCISE_DEFAULTS.repMin,
      repMax: pe?.rep_max ?? ADDED_EXERCISE_DEFAULTS.repMax,
      targetSets: pe?.target_sets ?? ADDED_EXERCISE_DEFAULTS.targetSets,
      increment: Number(s.exercise.weight_increment),
    });
  }

  const [history, previousRes] = await Promise.all([
    loadExerciseHistory(supabase, [...seen], {
      startedAtOrBefore: workout.started_at,
      excludeWorkoutId: workout.id,
    }),
    workout.program_day_id
      ? supabase
          .from("workouts")
          .select("id, workout_sets ( weight, reps, is_completed )")
          .eq("user_id", userId)
          .eq("status", "completed")
          .eq("program_day_id", workout.program_day_id)
          .neq("id", workout.id)
          .lte("started_at", workout.started_at)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (previousRes.error) throw previousRes.error;

  const summary = buildWorkoutSummary({
    startedAt: workout.started_at,
    finishedAt: workout.finished_at,
    exercises: exercises.map((e) => {
      const h = history.get(e.exerciseId);
      return { ...e, history: h?.history ?? [], best: h?.best ?? null };
    }),
    sets: setsRes.data.map((s) => ({
      exerciseId: s.exercise_id,
      weight: Number(s.weight),
      reps: s.reps,
      isCompleted: s.is_completed,
    })),
    previous: previousRes.data
      ? {
          sets: previousRes.data.workout_sets.map((s) => ({
            weight: Number(s.weight),
            reps: s.reps,
            isCompleted: s.is_completed,
          })),
        }
      : null,
  });

  // Наступний день програми — по колу після дня ЦЬОГО тренування.
  let nextUp: NextUp | null = null;
  if (workout.program_day_id && day?.program) {
    const days = [...day.program.program_days].sort((a, b) => a.position - b.position);
    const next = pickNextDay(days, [{ program_day_id: workout.program_day_id }]);
    if (next) {
      const names = [...next.program_exercises]
        .sort((a, b) => a.position - b.position)
        .map((pe) => pe.exercises?.name ?? "Exercise");
      nextUp = {
        name: next.name,
        preview: names.slice(0, NEXT_UP_PREVIEW),
        more: Math.max(0, names.length - NEXT_UP_PREVIEW),
      };
    }
  }

  return {
    kind: "ok",
    data: {
      workoutId: workout.id,
      name: workout.name,
      programName: day?.program?.name ?? null,
      dayName: day?.name ?? null,
      startedAt: workout.started_at,
      notes: workout.notes ?? "",
      unit: profileRes.data?.unit ?? "kg",
      summary,
      nextUp,
    },
  };
}
