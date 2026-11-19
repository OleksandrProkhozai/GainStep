import type { SupabaseClient } from "@supabase/supabase-js";
import { historyBest, type PersonalBest, type Session } from "@/lib/progression";
import type { Database } from "@/types/database.types";
import { getTemplateNames, templateName } from "@/lib/programs/template-names";
import { groupSessionRows } from "./history";
import type { ExerciseSession } from "./records";
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

/** Зріз історії «на момент» тренування (для підсумку старого тренування). */
export type HistoryCutoff = {
  /** Лише тренування, що почалися не пізніше (started_at ≤). */
  startedAtOrBefore: string;
  /** Тренування, яке з історії виключаємо (саме поточне); без нього — нічого не виключаємо. */
  excludeWorkoutId?: string;
};

/**
 * Завершені тренування кожної вправи з набору — одним запитом (без N+1).
 * Працює і з серверним, і з браузерним клієнтом: доступ до чужих тренувань
 * відсікає RLS. Тренування — від найновішого, підходи — за номером.
 * `cutoff` — лише історія ДО заданого тренування (екран підсумку).
 */
export async function loadExerciseSessions(
  supabase: Client,
  exerciseIds: string[],
  cutoff?: HistoryCutoff,
): Promise<Map<string, ExerciseSession[]>> {
  if (exerciseIds.length === 0) return new Map();

  let query = supabase
    .from("workout_sets")
    .select(
      "exercise_id, workout_id, set_number, weight, reps, is_completed, workouts!inner ( started_at, status )",
    )
    .in("exercise_id", exerciseIds)
    .eq("workouts.status", "completed");
  if (cutoff) {
    query = query.lte("workouts.started_at", cutoff.startedAtOrBefore);
    if (cutoff.excludeWorkoutId) query = query.neq("workout_id", cutoff.excludeWorkoutId);
  }
  const { data, error } = await query
    .order("workouts(started_at)", { ascending: false })
    .limit(HISTORY_ROWS_LIMIT);
  if (error) throw error;

  return groupSessionRows(
    data.map((row) => ({
      exerciseId: row.exercise_id,
      workoutId: row.workout_id,
      startedAt: row.workouts.started_at,
      setNumber: row.set_number,
      weight: Number(row.weight),
      reps: row.reps,
      isCompleted: row.is_completed,
    })),
  );
}

/** Тренування вправ → два останні (від найновішого) + найкращі показники за всю історію. */
export function toExerciseHistory(sessions: Map<string, ExerciseSession[]>) {
  const result = new Map<string, ExerciseHistory>();
  for (const [exerciseId, list] of sessions) {
    result.set(exerciseId, {
      history: list.slice(0, RECENT_SESSIONS).map((s) => ({ sets: s.sets })),
      best: historyBest(list),
    });
  }
  return result;
}

/**
 * Історія ЗАВЕРШЕНИХ тренувань для набору вправ — одним запитом (без N+1):
 * для кожної вправи два останні тренування і найкращі показники за всю історію.
 */
export async function loadExerciseHistory(
  supabase: Client,
  exerciseIds: string[],
  cutoff?: HistoryCutoff,
): Promise<Map<string, ExerciseHistory>> {
  return toExerciseHistory(await loadExerciseSessions(supabase, exerciseIds, cutoff));
}

type ExerciseRow = {
  id: string;
  name: string;
  name_uk: string | null;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  weight_increment: number;
  image_path: string | null;
  owner_id: string | null;
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
    nameUk: exercise.name_uk,
    muscleGroup: exercise.muscle_group,
    equipment: exercise.equipment,
    increment: Number(exercise.weight_increment),
    imagePath: exercise.image_path,
    custom: exercise.owner_id !== null,
    ...params,
    history: history?.history ?? [],
    best: history?.best ?? null,
  };
}

const EXERCISE_COLUMNS = "id, name, name_uk, muscle_group, equipment, weight_increment, image_path, owner_id";

export type LoadWorkoutResult =
  | { kind: "ok"; data: WorkoutInit }
  | { kind: "not-found" }
  | { kind: "completed" };

/**
 * Дані екрана активного тренування. Дві хвилі запитів:
 *  1) тренування з днем програми та його вправами, уже збережені
 *     підходи цього тренування (одиниці — з useUnit() на клієнті);
 *  2) історія завершених тренувань для всіх вправ — одним запитом.
 */
export async function loadWorkout(
  supabase: Client,
  workoutId: string,
  userId: string,
  /** Мова стандартних назв шаблонів (назва тренування, програми). */
  locale = "en",
): Promise<LoadWorkoutResult> {
  const [workoutRes, setsRes, templateNames] = await Promise.all([
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
    supabase
      .from("workout_sets")
      .select(
        `exercise_id, exercise_position, set_number, weight, reps, is_completed, completed_at,
         exercise:exercises ( ${EXERCISE_COLUMNS} )`,
      )
      .eq("workout_id", workoutId)
      .order("exercise_position")
      .order("set_number"),
    getTemplateNames(supabase),
  ]);
  if (workoutRes.error) throw workoutRes.error;
  if (setsRes.error) throw setsRes.error;

  const workout = workoutRes.data;
  if (!workout) return { kind: "not-found" };
  if (workout.status === "completed") return { kind: "completed" };
  const programName = workout.program_day?.program?.name;

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
      name: templateName(workout.name, templateNames, locale),
      programName: programName ? templateName(programName, templateNames, locale) : null,
      startedAt: workout.started_at,
      notes: workout.notes ?? "",
      exercises: ordered.map((o) =>
        toWorkoutExercise(o.exercise, o.params, history.get(o.exercise.id)),
      ),
      savedSets,
    },
  };
}
