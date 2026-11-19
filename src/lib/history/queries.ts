import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, toDayKey } from "@/lib/dates";
import { getTemplateNames, templateName, type TemplateNames } from "@/lib/programs/template-names";
import { loadExerciseSessions } from "@/lib/workout/queries";
import { ADDED_EXERCISE_DEFAULTS } from "@/lib/workout/types";
import type { Database } from "@/types/database.types";
import {
  analyzeExerciseSessions,
  assembleWorkout,
  filterWorkouts,
  groupByWeek,
  monthSummary,
  recentRecords,
  type AnalyzedSession,
  type HistoryExerciseMeta,
  type HistoryFilters,
  type HistoryWorkout,
  type MonthSummary,
  type ProgressionParams,
  type RawHistoryWorkout,
  type WeekGroup,
} from "./derive";
import { historyRange, inRange, monthBounds, queryBounds } from "./month";

type Client = SupabaseClient<Database>;

/** Тренування з днем програми та підходами з вправами — один запит (без N+1). */
const WORKOUT_SELECT = `id, name, status, started_at, finished_at, notes, program_day_id,
  program_day:program_days ( program_id, program_exercises ( exercise_id, target_sets, rep_min, rep_max ) ),
  workout_sets ( exercise_id, exercise_position, set_number, weight, reps, is_completed, completed_at,
    exercise:exercises ( id, name, name_uk, muscle_group, image_path, owner_id, weight_increment ) )`;

type WorkoutRow = {
  id: string;
  name: string;
  status: Database["public"]["Enums"]["workout_status"];
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  program_day_id: string | null;
  program_day: {
    program_id: string;
    program_exercises: { exercise_id: string; target_sets: number; rep_min: number; rep_max: number }[];
  } | null;
  workout_sets: {
    exercise_id: string;
    exercise_position: number;
    set_number: number;
    weight: number;
    reps: number;
    is_completed: boolean;
    completed_at: string | null;
    exercise: {
      id: string;
      name: string;
      name_uk: string | null;
      muscle_group: string;
      image_path: string | null;
      owner_id: string | null;
      weight_increment: number;
    } | null;
  }[];
};

export type HistoryData = {
  workouts: HistoryWorkout[];
  /** Аналіз історії вправ (рекорди, розвантаження) — для "Останніх рекордів" і експорту. */
  analysis: Map<string, AnalyzedSession[]>;
  /** Довідка про вправи з цих тренувань. */
  exercises: Map<string, HistoryExerciseMeta>;
};

/** Рядок бази → тренування для аналізу + параметри прогресії його вправ. */
function toRaw(row: WorkoutRow, names: TemplateNames, locale: string) {
  const params = new Map<string, ProgressionParams>();
  const byExercise = new Map<string, RawHistoryWorkout["exercises"][number]>();
  const programParams = new Map((row.program_day?.program_exercises ?? []).map((pe) => [pe.exercise_id, pe]));

  const sets = [...row.workout_sets].sort(
    (a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number,
  );
  for (const s of sets) {
    if (!s.exercise) continue;
    let entry = byExercise.get(s.exercise_id);
    if (!entry) {
      entry = {
        meta: {
          exerciseId: s.exercise.id,
          name: s.exercise.name,
          nameUk: s.exercise.name_uk,
          muscleGroup: s.exercise.muscle_group,
          imagePath: s.exercise.image_path,
          custom: s.exercise.owner_id !== null,
        },
        sets: [],
      };
      byExercise.set(s.exercise_id, entry);
      const pe = programParams.get(s.exercise_id);
      params.set(s.exercise_id, {
        repMin: pe?.rep_min ?? ADDED_EXERCISE_DEFAULTS.repMin,
        repMax: pe?.rep_max ?? ADDED_EXERCISE_DEFAULTS.repMax,
        targetSets: pe?.target_sets ?? ADDED_EXERCISE_DEFAULTS.targetSets,
        increment: Number(s.exercise.weight_increment),
      });
    }
    entry.sets.push({
      setNumber: s.set_number,
      weight: Number(s.weight),
      reps: s.reps,
      isCompleted: s.is_completed,
      completedAt: s.completed_at,
    });
  }
  // Підходи кожної вправи — за номером (як у loadExerciseSessions).
  for (const e of byExercise.values()) e.sets.sort((a, b) => a.setNumber - b.setNumber);

  const raw: RawHistoryWorkout = {
    id: row.id,
    name: templateName(row.name, names, locale),
    programId: row.program_day?.program_id ?? null,
    programDayId: row.program_day_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    notes: row.notes,
    dayKey: toDayKey(row.started_at),
    exercises: [...byExercise.values()],
  };
  return { raw, params };
}

/**
 * Рядки тренувань → тренування історії з рекордами й розвантаженням.
 * Друга хвиля — ВСЯ попередня історія вправ цих тренувань (до
 * найпізнішого з них) одним запитом; рекорди рахуються в JS.
 */
async function analyzeRows(
  supabase: Client,
  rows: WorkoutRow[],
  names: TemplateNames,
  locale: string,
): Promise<HistoryData> {
  const prepared = rows.map((row) => toRaw(row, names, locale));
  const exercises = new Map<string, HistoryExerciseMeta>();
  for (const { raw } of prepared) for (const e of raw.exercises) exercises.set(e.meta.exerciseId, e.meta);

  const latest = rows.reduce<string | null>((max, r) => (max === null || r.started_at > max ? r.started_at : max), null);
  const sessions =
    latest === null
      ? new Map()
      : await loadExerciseSessions(supabase, [...exercises.keys()], { startedAtOrBefore: latest });

  const paramsByWorkout = new Map(prepared.map(({ raw, params }) => [raw.id, params]));
  const analysis = new Map<string, AnalyzedSession[]>();
  for (const [exerciseId, list] of sessions) {
    analysis.set(
      exerciseId,
      analyzeExerciseSessions(list, (workoutId) => paramsByWorkout.get(workoutId)?.get(exerciseId)),
    );
  }

  return {
    workouts: prepared.map(({ raw }) => assembleWorkout(raw, analysis)),
    analysis,
    exercises,
  };
}

/**
 * Завершені тренування за діапазон календарних днів (у поясі
 * користувача, включно), від найновішого. first = null — від початку.
 */
export async function loadHistoryWorkouts(
  supabase: Client,
  userId: string,
  range: { first: string | null; last: string },
  locale: string,
): Promise<HistoryData> {
  const bounds = queryBounds(range.first, range.last);
  let query = supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", userId)
    .eq("status", "completed")
    .lt("started_at", bounds.to);
  if (bounds.from) query = query.gte("started_at", bounds.from);

  const [res, names] = await Promise.all([
    query.order("started_at", { ascending: false }),
    getTemplateNames(supabase),
  ]);
  if (res.error) throw res.error;

  const rows = (res.data as unknown as WorkoutRow[]).filter((r) =>
    inRange(toDayKey(r.started_at), range.first, range.last),
  );
  return analyzeRows(supabase, rows, names, locale);
}

export type LoadHistoryWorkoutResult =
  | { kind: "ok"; workout: HistoryWorkout }
  | { kind: "not-found" }
  | { kind: "in-progress" };

/** Одне тренування для сторінки /workouts/[id] (рекорди — відносно історії до нього). */
export async function loadHistoryWorkout(
  supabase: Client,
  userId: string,
  workoutId: string,
  locale: string,
): Promise<LoadHistoryWorkoutResult> {
  const [res, names] = await Promise.all([
    supabase.from("workouts").select(WORKOUT_SELECT).eq("id", workoutId).eq("user_id", userId).maybeSingle(),
    getTemplateNames(supabase),
  ]);
  if (res.error) throw res.error;
  const row = res.data as unknown as WorkoutRow | null;
  if (!row) return { kind: "not-found" };
  if (row.status !== "completed") return { kind: "in-progress" };
  const data = await analyzeRows(supabase, [row], names, locale);
  return { kind: "ok", workout: data.workouts[0] };
}

/** Дні з тренуваннями для календаря — лише дати (легкий запит). */
export async function loadTrainingDays(
  supabase: Client,
  userId: string,
  first: string,
  last: string,
): Promise<string[]> {
  const bounds = queryBounds(first, last);
  const { data, error } = await supabase
    .from("workouts")
    .select("started_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("started_at", bounds.from!)
    .lt("started_at", bounds.to);
  if (error) throw error;
  const days = new Set<string>();
  for (const w of data) {
    const key = toDayKey(w.started_at);
    if (inRange(key, first, last)) days.add(key);
  }
  return [...days].sort();
}

/** День найпершого завершеного тренування (для кнопки "Показати попередній місяць"). */
async function loadEarliestDay(supabase: Client, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("workouts")
    .select("started_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toDayKey(data.started_at) : null;
}

export type FilterOption = { id: string; name: string; nameUk?: string | null };

/** Варіанти фільтрів: власні програми і доступні вправи (системні + власні). */
async function loadFilterOptions(supabase: Client, userId: string, locale: string) {
  const [programsRes, exercisesRes, names] = await Promise.all([
    supabase.from("programs").select("id, name").eq("owner_id", userId).order("created_at"),
    supabase.from("exercises").select("id, name, name_uk").order("name"),
    getTemplateNames(supabase),
  ]);
  if (programsRes.error) throw programsRes.error;
  if (exercisesRes.error) throw exercisesRes.error;
  return {
    programs: programsRes.data.map((p) => ({ id: p.id, name: templateName(p.name, names, locale) })),
    exercises: exercisesRes.data.map((e) => ({ id: e.id, name: e.name, nameUk: e.name_uk })),
  };
}

export type RecentRecordView = {
  exerciseId: string;
  workoutId: string;
  name: string;
  nameUk: string | null;
  startedAt: string;
  weight: number;
  reps: number;
};

export type HistoryPageData = {
  month: string;
  more: number;
  today: string;
  /** Дні з тренуваннями видимого місяця календаря (± сусідні тижні). */
  trainingDays: string[];
  summary: MonthSummary;
  records: RecentRecordView[];
  weeks: WeekGroup<HistoryWorkout>[];
  /** Чи є тренування в діапазоні до фільтрів (порожній стан "нічого не знайдено"). */
  totalInRange: number;
  /** Чи є ще старіші тренування. */
  hasEarlier: boolean;
  filters: HistoryFilters;
  options: { programs: FilterOption[]; exercises: FilterOption[] };
};

/**
 * Дані сторінки /workouts/history. Дві хвилі:
 *  1) тренування діапазону (з підходами й вправами), дні календаря,
 *     найперше тренування, варіанти фільтрів — паралельно;
 *  2) історія вправ цих тренувань — одним запитом (рекорди).
 * Підсумок місяця рахується до фільтрів, список — після.
 */
export async function getHistoryPageData(
  supabase: Client,
  userId: string,
  input: { month: string; more: number; filters: HistoryFilters; today: string },
  locale: string,
): Promise<HistoryPageData> {
  const range = historyRange(input.month, input.more);
  const month = monthBounds(input.month);

  const [data, trainingDays, earliest, options] = await Promise.all([
    loadHistoryWorkouts(supabase, userId, range, locale),
    // Календар показує й дні сусідніх місяців (до тижня з кожного боку).
    loadTrainingDays(supabase, userId, addDays(month.first, -7), addDays(month.last, 7)),
    loadEarliestDay(supabase, userId),
    loadFilterOptions(supabase, userId, locale),
  ]);

  const inMonth = data.workouts.filter((w) => inRange(w.dayKey, month.first, month.last));
  const filtered = filterWorkouts(data.workouts, input.filters);

  const records = recentRecords(data.analysis, 3).map((r) => {
    const meta = data.exercises.get(r.exerciseId);
    return {
      exerciseId: r.exerciseId,
      workoutId: r.workoutId,
      name: meta?.name ?? "—",
      nameUk: meta?.nameUk ?? null,
      startedAt: r.startedAt,
      weight: r.weight,
      reps: r.reps,
    };
  });

  return {
    month: input.month,
    more: input.more,
    today: input.today,
    trainingDays,
    summary: monthSummary(inMonth),
    records,
    weeks: groupByWeek(filtered, input.today),
    totalInRange: data.workouts.length,
    hasEarlier: earliest !== null && earliest < range.first,
    filters: input.filters,
    options,
  };
}
