import type { SupabaseClient } from "@supabase/supabase-js";
import { pickNextDay } from "@/lib/dashboard/queries";
import type { WeightUnit } from "@/lib/units";
import type { Database } from "@/types/database.types";
import { loadExerciseHistory } from "./queries";
import { buildWorkoutSummary, type SummaryExerciseInput, type WorkoutSummary } from "./summary";
import { localizedName } from "@/lib/i18n/names";
import { getTemplateNames, templateName } from "@/lib/programs/template-names";
import { hasPlanChanges, parsePlan, planChanges, progressionParams } from "./plan";

type Client = SupabaseClient<Database>;

/** Скільки назв вправ показуємо на картці "Next up". */
const NEXT_UP_PREVIEW = 3;

export type NextUp = { name: string; preview: string[]; more: number };

/** Картка "Ви змінили склад тренування" (лише власні програми, не шаблони). */
export type PlanChangesCard = {
  dayName: string;
  /** Назви доданих вправ (у порядку тренування). */
  added: string[];
  /** Назви прибраних вправ (у порядку дня). */
  removed: string[];
};

export type SummaryPageData = {
  workoutId: string;
  name: string;
  programName: string | null;
  /** Назва дня програми (для "vs last Push"); null — тренування не з програми. */
  dayName: string | null;
  startedAt: string;
  notes: string;
  /** Одиниці користувача — з getCurrentUser() (сторінка додає). */
  unit: WeightUnit;
  summary: WorkoutSummary;
  nextUp: NextUp | null;
  planChanges: PlanChangesCard | null;
};

export type LoadSummaryResult =
  | { kind: "ok"; data: Omit<SummaryPageData, "unit"> }
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
  /** Мова назв системних вправ і шаблонів (name_uk). */
  locale = "en",
  /** Одиниці користувача — крок "Наступного разу" (lb: 5 lb). */
  unit: WeightUnit = "kg",
): Promise<LoadSummaryResult> {
  const [workoutRes, setsRes, templateNames] = await Promise.all([
    supabase
      .from("workouts")
      .select(
        `id, name, status, started_at, finished_at, notes, program_day_id, exercise_plan,
         program_day:program_days (
           name,
           program_exercises ( exercise_id, position, target_sets, rep_min, rep_max, exercises ( name, name_uk ) ),
           program:programs (
             name, owner_id,
             program_days ( id, name, position,
               program_exercises ( position, exercises ( name, name_uk ) ) )
           )
         )`,
      )
      .eq("id", workoutId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("workout_sets")
      .select(
        "exercise_id, exercise_position, set_number, weight, reps, is_completed, exercise:exercises ( id, name, name_uk, weight_increment, muscle_group, equipment )",
      )
      .eq("workout_id", workoutId)
      .order("exercise_position")
      .order("set_number"),
    getTemplateNames(supabase),
  ]);
  if (workoutRes.error) throw workoutRes.error;
  // Стандартні назви копій шаблонів і тренувань — мовою інтерфейсу.
  const tn = (name: string) => templateName(name, templateNames, locale);
  if (setsRes.error) throw setsRes.error;

  const workout = workoutRes.data;
  if (!workout) return { kind: "not-found" };
  if (workout.status !== "completed") return { kind: "in-progress" };

  const day = workout.program_day;
  const plan = parsePlan(workout.exercise_plan);
  // Параметри прогресії: склад тренування → день програми → значення доданої вправи.
  const paramsOf = progressionParams(plan, day?.program_exercises ?? []);

  // Вправи в порядку виконання (exercise_position), кожна — один раз.
  const exercises: Omit<SummaryExerciseInput, "history" | "best">[] = [];
  const seen = new Set<string>();
  for (const s of setsRes.data) {
    if (!s.exercise || seen.has(s.exercise_id)) continue;
    seen.add(s.exercise_id);
    exercises.push({
      exerciseId: s.exercise_id,
      name: localizedName(s.exercise, locale),
      muscleGroup: s.exercise.muscle_group,
      ...paramsOf(s.exercise_id),
      increment: Number(s.exercise.weight_increment),
      equipment: s.exercise.equipment,
    });
  }

  // Зміни складу відносно ПОТОЧНОГО дня програми (лише власна програма).
  const dayExercises = [...(day?.program_exercises ?? [])].sort((a, b) => a.position - b.position);
  const changes =
    day?.program && day.program.owner_id === userId
      ? planChanges(plan, dayExercises.map((pe) => pe.exercise_id))
      : null;
  const addedNamesMissing = (changes?.added ?? [])
    .map((p) => p.exercise_id)
    .filter((id) => !setsRes.data.some((s) => s.exercise_id === id));

  const [history, previousRes, addedRes] = await Promise.all([
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
    // Додані вправи без виконаних підходів (їх немає серед workout_sets) — назви окремо.
    addedNamesMissing.length > 0
      ? supabase.from("exercises").select("id, name, name_uk").in("id", addedNamesMissing)
      : Promise.resolve({ data: [] as { id: string; name: string; name_uk: string | null }[], error: null }),
  ]);
  if (previousRes.error) throw previousRes.error;
  if (addedRes.error) throw addedRes.error;

  let planChangesCard: PlanChangesCard | null = null;
  if (changes && day && hasPlanChanges(changes)) {
    const names = new Map<string, string>();
    for (const s of setsRes.data) if (s.exercise) names.set(s.exercise_id, localizedName(s.exercise, locale));
    for (const e of addedRes.data ?? []) names.set(e.id, localizedName(e, locale));
    for (const pe of dayExercises) if (pe.exercises) names.set(pe.exercise_id, localizedName(pe.exercises, locale));
    planChangesCard = {
      dayName: tn(day.name),
      added: changes.added.map((p) => names.get(p.exercise_id) ?? "—"),
      removed: changes.removed.map((id) => names.get(id) ?? "—"),
    };
  }

  const summary = buildWorkoutSummary({
    unit,
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
        .map((pe) => (pe.exercises ? localizedName(pe.exercises, locale) : "—"));
      nextUp = {
        name: tn(next.name),
        preview: names.slice(0, NEXT_UP_PREVIEW),
        more: Math.max(0, names.length - NEXT_UP_PREVIEW),
      };
    }
  }

  return {
    kind: "ok",
    data: {
      workoutId: workout.id,
      name: tn(workout.name),
      programName: day?.program ? tn(day.program.name) : null,
      dayName: day ? tn(day.name) : null,
      startedAt: workout.started_at,
      notes: workout.notes ?? "",
      summary,
      nextUp,
      planChanges: planChangesCard,
    },
  };
}
