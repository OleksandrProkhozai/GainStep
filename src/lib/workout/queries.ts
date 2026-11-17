import type { SupabaseClient } from "@supabase/supabase-js";
import { historyBest, type PersonalBest, type Session } from "@/lib/progression";
import type { Database } from "@/types/database.types";
import {
  ADDED_EXERCISE_DEFAULTS,
  type Equipment,
  type MuscleGroup,
  type SavedSet,
  type WorkoutExercise,
  type WorkoutInit,
} from "./types";

type Client = SupabaseClient<Database>;

/** Скільки останніх тренувань вправи передаємо на клієнт. */
const RECENT_SESSIONS = 2;
/** Верхня межа рядків історії (рекорди рахуються в цих межах). */
const HISTORY_ROWS_LIMIT = 5000;

export type ExerciseHistory = { history: Session[]; best: PersonalBest | null };

/**
 * Історія ЗАВЕРШЕНИХ тренувань для набору вправ — одним запитом (без N+1).
 * Працює і з серверним, і з браузерним клієнтом: доступ до чужих тренувань
 * відсікає RLS. Повертає для кожної вправи два останні тренування
 * (від найновішого) і найкращі показники за всю історію.
 */
export async function loadExerciseHistory(
  supabase: Client,
  exerciseIds: string[],
): Promise<Map<string, ExerciseHistory>> {
  const result = new Map<string, ExerciseHistory>();
  if (exerciseIds.length === 0) return result;

  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      "exercise_id, workout_id, set_number, weight, reps, is_completed, workouts!inner ( started_at, status )",
    )
    .in("exercise_id", exerciseIds)
    .eq("workouts.status", "completed")
    .order("workouts(started_at)", { ascending: false })
    .limit(HISTORY_ROWS_LIMIT);
  if (error) throw error;

  // вправа → тренування → підходи
  const grouped = new Map<
    string,
    Map<string, { startedAt: string; sets: { n: number; set: Session["sets"][number] }[] }>
  >();
  for (const row of data) {
    let byWorkout = grouped.get(row.exercise_id);
    if (!byWorkout) grouped.set(row.exercise_id, (byWorkout = new Map()));
    let session = byWorkout.get(row.workout_id);
    if (!session) {
      session = { startedAt: row.workouts.started_at, sets: [] };
      byWorkout.set(row.workout_id, session);
    }
    session.sets.push({
      n: row.set_number,
      set: { weight: Number(row.weight), reps: row.reps, isCompleted: row.is_completed },
    });
  }

  for (const [exerciseId, byWorkout] of grouped) {
    const sessions: Session[] = [...byWorkout.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((s) => ({ sets: s.sets.sort((a, b) => a.n - b.n).map((x) => x.set) }));
    result.set(exerciseId, {
      history: sessions.slice(0, RECENT_SESSIONS),
      best: historyBest(sessions),
    });
  }
  return result;
}

type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  weight_increment: number;
};

/** Рядок exercises + параметри дня → вправа тренування (поки без історії). */
export function toWorkoutExercise(
  exercise: ExerciseRow,
  params: Pick<WorkoutExercise, "targetSets" | "repMin" | "repMax" | "restSeconds">,
  history?: ExerciseHistory,
): WorkoutExercise {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscle_group,
    equipment: exercise.equipment,
    increment: Number(exercise.weight_increment),
    ...params,
    history: history?.history ?? [],
    best: history?.best ?? null,
  };
}

const EXERCISE_COLUMNS = "id, name, muscle_group, equipment, weight_increment";

export type LoadWorkoutResult =
  | { kind: "ok"; data: WorkoutInit }
  | { kind: "not-found" }
  | { kind: "completed" };

/**
 * Дані екрана активного тренування. Дві хвилі запитів:
 *  1) тренування з днем програми та його вправами, профіль (одиниці),
 *     уже збережені підходи цього тренування;
 *  2) історія завершених тренувань для всіх вправ — одним запитом.
 */
export async function loadWorkout(
  supabase: Client,
  workoutId: string,
  userId: string,
): Promise<LoadWorkoutResult> {
  const [workoutRes, profileRes, setsRes] = await Promise.all([
    supabase
      .from("workouts")
      .select(
        `id, name, status, started_at, notes,
         program_day:program_days (
           name,
           program:programs ( name ),
           program_exercises ( position, target_sets, rep_min, rep_max, rest_seconds,
             exercise:exercises ( ${EXERCISE_COLUMNS} ) )
         )`,
      )
      .eq("id", workoutId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("unit").eq("id", userId).maybeSingle(),
    supabase
      .from("workout_sets")
      .select(
        `exercise_id, exercise_position, set_number, weight, reps, is_completed, completed_at,
         exercise:exercises ( ${EXERCISE_COLUMNS} )`,
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
  if (workout.status === "completed") return { kind: "completed" };

  // Вправи дня (за position) + вправи, додані під час тренування (з workout_sets).
  // Одна вправа — один раз: ключ workout_sets містить exercise_id.
  const ordered: { exercise: ExerciseRow; params: Parameters<typeof toWorkoutExercise>[1] }[] = [];
  const seen = new Set<string>();
  const dayExercises = [...(workout.program_day?.program_exercises ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  for (const pe of dayExercises) {
    if (!pe.exercise || seen.has(pe.exercise.id)) continue;
    seen.add(pe.exercise.id);
    ordered.push({
      exercise: pe.exercise,
      params: {
        targetSets: pe.target_sets,
        repMin: pe.rep_min,
        repMax: pe.rep_max,
        restSeconds: pe.rest_seconds,
      },
    });
  }
  for (const s of setsRes.data) {
    if (!s.exercise || seen.has(s.exercise.id)) continue;
    seen.add(s.exercise.id);
    ordered.push({ exercise: s.exercise, params: { ...ADDED_EXERCISE_DEFAULTS } });
  }

  const history = await loadExerciseHistory(supabase, [...seen]);

  const savedSets: SavedSet[] = setsRes.data.map((s) => ({
    exerciseId: s.exercise_id,
    setNumber: s.set_number,
    weightKg: Number(s.weight),
    reps: s.reps,
    isCompleted: s.is_completed,
    completedAt: s.completed_at,
  }));

  return {
    kind: "ok",
    data: {
      workoutId: workout.id,
      name: workout.name,
      programName: workout.program_day?.program?.name ?? null,
      startedAt: workout.started_at,
      notes: workout.notes ?? "",
      unit: profileRes.data?.unit ?? "kg",
      exercises: ordered.map((o) =>
        toWorkoutExercise(o.exercise, o.params, history.get(o.exercise.id)),
      ),
      savedSets,
    },
  };
}
