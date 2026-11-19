import type { SupabaseClient } from "@supabase/supabase-js";
import { localizedName } from "@/lib/i18n/names";
import { getTemplateNames, templateName } from "@/lib/programs/template-names";
import { addDays, startOfWeek, toDayKey } from "@/lib/dates";
import { epley1RM, sessionVolume } from "@/lib/metrics";
import { suggestNextWeight, type Suggestion } from "@/lib/progression";
import { loadExerciseSessions } from "@/lib/workout/queries";
import { countPRExercisesInWorkouts, type ExerciseSession } from "@/lib/workout/records";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

export type ProgressPoint = {
  /** Початок тренування, ISO. */
  date: string;
  /** Найкраща оцінка 1ПМ за тренування, кг. */
  oneRmKg: number;
};

/** Рекомендація алгоритму для вправи сьогоднішнього дня (картка "Smart progression"). */
export type SmartSuggestion = {
  exerciseId: string;
  name: string;
  /** Група м'язів — для мініатюри. */
  muscleGroup?: string;
  repMin: number;
  repMax: number;
  suggestion: Suggestion;
};

export type DashboardData = {
  program: { id: string; name: string } | null;
  today: { id: string; name: string } | null;
  /** Незавершене тренування (кнопка "Continue workout"). */
  activeWorkout: { id: string; name: string } | null;
  /** prs — кількість вправ з рекордом у тренуваннях тижня. */
  week: { volumeKg: number; workouts: number; prs: number };
  /** Вправи сьогоднішнього дня з рекомендацією (без 'none'), у порядку дня. */
  smartProgression: SmartSuggestion[];
  streakWeeks: number;
  progress: { exerciseName: string; points: ProgressPoint[] } | null;
};

/** Скільки завершених тренувань читаємо для "сьогоднішнього дня" і серії. */
const RECENT_WORKOUTS_LIMIT = 500;
/** Графік показує максимум рік. */
const PROGRESS_DAYS = 366;

/**
 * Усі дані дашборду, без N+1:
 *  1) профіль з активною програмою, днями й вправами + завершені тренування;
 *  2) паралельно: графік прогресу і ланцюжок «підходи поточного тижня →
 *     історія (одним запитом) для вправ тижня та сьогоднішнього дня».
 *     З історії рахуються рекомендації ("Smart progression") і рекорди тижня.
 */
export async function getDashboardData(
  supabase: Client,
  userId: string,
  now = new Date(),
  /** Мова назв системних вправ (name_uk). */
  locale = "en",
): Promise<DashboardData> {
  const [profileRes, workoutsRes, activeRes, templateNames] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        `program:programs!profiles_active_program_id_fkey (
           id, name,
           program_days ( id, name, position,
             program_exercises ( position, exercise_id, target_sets, rep_min, rep_max,
               exercises ( name, name_uk, weight_increment, muscle_group ) )
           )
         )`,
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, program_day_id, started_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(RECENT_WORKOUTS_LIMIT),
    supabase
      .from("workouts")
      .select("id, name")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getTemplateNames(supabase),
  ]);
  if (profileRes.error) throw profileRes.error;
  // Стандартні назви копій шаблонів і тренувань — мовою інтерфейсу.
  const tn = (name: string) => templateName(name, templateNames, locale);
  if (workoutsRes.error) throw workoutsRes.error;
  if (activeRes.error) throw activeRes.error;

  const profile = profileRes.data;
  const workouts = workoutsRes.data;
  const program = profile?.program ?? null;
  const days = [...(program?.program_days ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  // --- Сьогоднішній день: наступний по колу після останнього тренування програми
  const todayDay = pickNextDay(days, workouts);

  // --- Тиждень і серія (тижні з понеділка, у поясі користувача)
  const currentWeek = startOfWeek(toDayKey(now));
  const weeksWithWorkouts = new Set<string>();
  const thisWeekIds: string[] = [];
  for (const w of workouts) {
    const week = startOfWeek(toDayKey(w.started_at));
    weeksWithWorkouts.add(week);
    if (week === currentWeek) thisWeekIds.push(w.id);
  }
  const streakWeeks = countWeekStreak(weeksWithWorkouts, currentWeek);

  // --- Вправи сьогоднішнього дня; для графіка — позиція 0
  const todayExercises = [...(todayDay?.program_exercises ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const firstExercise = todayExercises[0];
  const progressSince = new Date(
    now.getTime() - PROGRESS_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [weekData, progress] = await Promise.all([
    getWeekSets(supabase, thisWeekIds).then(async (weekSets) => {
      const ids = new Set([
        ...todayExercises.map((pe) => pe.exercise_id),
        ...weekSets.map((s) => s.exercise_id),
      ]);
      const sessions = await loadExerciseSessions(supabase, [...ids]);
      return { weekSets, sessions };
    }),
    firstExercise
      ? getProgressPoints(supabase, firstExercise.exercise_id, progressSince).then(
          (points) => ({
            exerciseName: firstExercise.exercises ? localizedName(firstExercise.exercises, locale) : "—",
            points,
          }),
        )
      : workouts.length > 0
        ? getMostFrequentExerciseProgress(supabase, progressSince, locale)
        : Promise.resolve(null),
  ]);

  return {
    program: program ? { id: program.id, name: tn(program.name) } : null,
    today: todayDay ? { id: todayDay.id, name: tn(todayDay.name) } : null,
    activeWorkout: activeRes.data ? { id: activeRes.data.id, name: tn(activeRes.data.name) } : null,
    week: {
      volumeKg: sessionVolume(weekData.weekSets),
      workouts: thisWeekIds.length,
      prs: countPRExercisesInWorkouts(weekData.sessions.values(), new Set(thisWeekIds)),
    },
    smartProgression: buildSmartProgression(
      todayExercises.map((pe) => ({
        exerciseId: pe.exercise_id,
        name: pe.exercises ? localizedName(pe.exercises, locale) : "—",
        muscleGroup: pe.exercises?.muscle_group,
        repMin: pe.rep_min,
        repMax: pe.rep_max,
        targetSets: pe.target_sets,
        increment: Number(pe.exercises?.weight_increment ?? 2.5),
      })),
      weekData.sessions,
    ),
    streakWeeks,
    progress,
  };
}

/**
 * "Сьогоднішній" день програми: наступний по колу після дня останнього
 * завершеного тренування цієї програми; без таких тренувань — перший день.
 * @param days дні програми, відсортовані за position
 * @param workouts завершені тренування від найновішого (досить тих, що з днями програми)
 */
export function pickNextDay<D extends { id: string }>(
  days: D[],
  workouts: { program_day_id: string | null }[],
): D | null {
  if (days.length === 0) return null;
  const dayIndexById = new Map(days.map((d, i) => [d.id, i]));
  const last = workouts.find(
    (w) => w.program_day_id !== null && dayIndexById.has(w.program_day_id),
  );
  return last ? days[(dayIndexById.get(last.program_day_id!)! + 1) % days.length] : days[0];
}

/**
 * Кількість тижнів поспіль із хоча б одним тренуванням. Рахуємо від
 * поточного тижня, а якщо в ньому ще не тренувались — від попереднього
 * (серія не обривається в понеділок зранку).
 */
export function countWeekStreak(weeks: Set<string>, currentWeek: string) {
  let week = weeks.has(currentWeek) ? currentWeek : addDays(currentWeek, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

/**
 * Рекомендації алгоритму подвійної прогресії для вправ дня.
 * Вправи без історії ('none') пропускаються; порядок — як у дні.
 * @param sessions завершені тренування кожної вправи, від найновішого
 */
export function buildSmartProgression(
  exercises: {
    exerciseId: string;
    name: string;
    muscleGroup?: string;
    repMin: number;
    repMax: number;
    targetSets: number;
    increment: number;
  }[],
  sessions: Map<string, ExerciseSession[]>,
): SmartSuggestion[] {
  const result: SmartSuggestion[] = [];
  const seen = new Set<string>();
  for (const ex of exercises) {
    if (seen.has(ex.exerciseId)) continue;
    seen.add(ex.exerciseId);
    const suggestion = suggestNextWeight({
      history: sessions.get(ex.exerciseId) ?? [],
      repMin: ex.repMin,
      repMax: ex.repMax,
      targetSets: ex.targetSets,
      increment: ex.increment,
    });
    if (suggestion.action === "none") continue;
    result.push({
      exerciseId: ex.exerciseId,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      repMin: ex.repMin,
      repMax: ex.repMax,
      suggestion,
    });
  }
  return result;
}

/** Виконані підходи заданих (завершених) тренувань — для тоннажу і списку вправ тижня. */
async function getWeekSets(supabase: Client, workoutIds: string[]) {
  if (workoutIds.length === 0) return [];
  const { data, error } = await supabase
    .from("workout_sets")
    .select("exercise_id, weight, reps")
    .in("workout_id", workoutIds)
    .eq("is_completed", true);
  if (error) throw error;
  return data.map((s) => ({
    exercise_id: s.exercise_id,
    weight: Number(s.weight),
    reps: s.reps,
    isCompleted: true,
  }));
}

/** Найкраща оцінка 1ПМ вправи за кожне завершене тренування, від старих до нових. */
async function getProgressPoints(
  supabase: Client,
  exerciseId: string,
  since: string,
): Promise<ProgressPoint[]> {
  const { data, error } = await supabase
    .from("workout_sets")
    .select("weight, reps, workout_id, workouts!inner ( started_at, status )")
    .eq("exercise_id", exerciseId)
    .eq("is_completed", true)
    .eq("workouts.status", "completed")
    .gte("workouts.started_at", since)
    .limit(1000);
  if (error) throw error;

  const best = new Map<string, ProgressPoint>();
  for (const s of data) {
    const oneRmKg = epley1RM(s.weight, s.reps);
    const current = best.get(s.workout_id);
    if (!current || oneRmKg > current.oneRmKg) {
      best.set(s.workout_id, { date: s.workouts.started_at, oneRmKg });
    }
  }
  return [...best.values()]
    .filter((p) => p.oneRmKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Запасний варіант: вправа, що трапляється в найбільшій кількості тренувань. */
async function getMostFrequentExerciseProgress(supabase: Client, since: string, locale: string) {
  const { data, error } = await supabase
    .from("workout_sets")
    .select("exercise_id, workout_id, exercises ( name, name_uk ), workouts!inner ( status, started_at )")
    .eq("is_completed", true)
    .eq("workouts.status", "completed")
    .gte("workouts.started_at", since)
    .limit(1000);
  if (error) throw error;

  const workoutsByExercise = new Map<string, { name: string; ids: Set<string> }>();
  for (const s of data) {
    let entry = workoutsByExercise.get(s.exercise_id);
    if (!entry) {
      entry = { name: s.exercises ? localizedName(s.exercises, locale) : "—", ids: new Set() };
      workoutsByExercise.set(s.exercise_id, entry);
    }
    entry.ids.add(s.workout_id);
  }

  let topId: string | null = null;
  let topCount = 0;
  for (const [id, entry] of workoutsByExercise) {
    if (entry.ids.size > topCount) {
      topId = id;
      topCount = entry.ids.size;
    }
  }
  if (!topId) return null;

  return {
    exerciseName: workoutsByExercise.get(topId)!.name,
    points: await getProgressPoints(supabase, topId, since),
  };
}
