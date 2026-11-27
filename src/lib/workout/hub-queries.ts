import type { SupabaseClient } from "@supabase/supabase-js";
import { localizedName } from "@/lib/i18n/names";
import { getTemplateNames, templateName } from "@/lib/programs/template-names";
import { pickNextDay } from "@/lib/dashboard/queries";
import { listMyPrograms } from "@/lib/programs/active";
import { sessionVolume } from "@/lib/metrics";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

/** Скільки завершених тренувань показуємо в "Recent workouts". */
const RECENT_LIMIT = 10;
/** Скільки назв вправ показуємо на картці дня. */
const PREVIEW_EXERCISES = 3;

export type HubDay = {
  id: string;
  name: string;
  exerciseCount: number;
  /** Перші назви вправ (за position). */
  preview: string[];
  isNext: boolean;
};

export type HubRecent = {
  id: string;
  name: string;
  startedAt: string;
  finishedAt: string | null;
  volumeKg: number;
  setsDone: number;
};

export type WorkoutsHubData = {
  /** Активна програма; null — її немає (наприклад, видалили): шаблон не підставляємо. */
  program: { id: string; name: string; days: HubDay[] } | null;
  /** Власні програми — перемикач активної і порожній стан «Виберіть активну програму». */
  myPrograms: { id: string; name: string }[];
  active: { id: string; name: string; startedAt: string } | null;
  recent: HubRecent[];
};

/**
 * Дані сторінки /workouts. Дві паралельні хвилі запитів:
 *  1) профіль з активною програмою, днями та вправами; незавершене
 *     тренування; 10 останніх завершених;
 *  2) виконані підходи цих 10 тренувань (тоннаж і кількість — одним запитом)
 *     + останнє завершене тренування програми для бейджа "Up next".
 */
export async function getWorkoutsHubData(
  supabase: Client,
  userId: string,
  /** Мова назв системних вправ (name_uk). */
  locale = "en",
): Promise<WorkoutsHubData> {
  const [profileRes, activeRes, recentRes, templateNames, myPrograms] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        `program:programs!profiles_active_program_id_fkey (
           id, name,
           program_days ( id, name, position,
             program_exercises ( position, exercises ( name, name_uk ) )
           )
         )`,
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, name, started_at")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, name, started_at, finished_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(RECENT_LIMIT),
    getTemplateNames(supabase),
    listMyPrograms(supabase, userId),
  ]);
  // Стандартні назви копій шаблонів і тренувань — мовою інтерфейсу.
  const tn = (name: string) => templateName(name, templateNames, locale);
  if (profileRes.error) throw profileRes.error;
  if (activeRes.error) throw activeRes.error;
  if (recentRes.error) throw recentRes.error;

  const program = profileRes.data?.program ?? null;
  const days = [...(program?.program_days ?? [])].sort((a, b) => a.position - b.position);
  const recentIds = recentRes.data.map((w) => w.id);

  const [setsRes, lastProgramRes] = await Promise.all([
    recentIds.length > 0
      ? supabase
          .from("workout_sets")
          .select("workout_id, weight, reps")
          .in("workout_id", recentIds)
          .eq("is_completed", true)
      : Promise.resolve({ data: [], error: null }),
    days.length > 0
      ? supabase
          .from("workouts")
          .select("program_day_id")
          .eq("user_id", userId)
          .eq("status", "completed")
          .in(
            "program_day_id",
            days.map((d) => d.id),
          )
          .order("started_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (setsRes.error) throw setsRes.error;
  if (lastProgramRes.error) throw lastProgramRes.error;

  // Підходи по тренуваннях → тоннаж (функцією з metrics.ts) і кількість.
  const setsByWorkout = new Map<string, { weight: number; reps: number; isCompleted: boolean }[]>();
  for (const s of setsRes.data) {
    const list = setsByWorkout.get(s.workout_id) ?? [];
    list.push({ weight: Number(s.weight), reps: s.reps, isCompleted: true });
    setsByWorkout.set(s.workout_id, list);
  }

  const nextDay = pickNextDay(days, lastProgramRes.data);

  return {
    program: program
      ? {
          id: program.id,
          name: tn(program.name),
          days: days.map((d) => {
            const exercises = [...d.program_exercises].sort((a, b) => a.position - b.position);
            return {
              id: d.id,
              name: tn(d.name),
              exerciseCount: exercises.length,
              preview: exercises
                .slice(0, PREVIEW_EXERCISES)
                .map((e) => (e.exercises ? localizedName(e.exercises, locale) : "—")),
              isNext: d.id === nextDay?.id,
            };
          }),
        }
      : null,
    myPrograms: myPrograms.map((p) => ({ id: p.id, name: tn(p.name) })),
    active: activeRes.data
      ? { id: activeRes.data.id, name: tn(activeRes.data.name), startedAt: activeRes.data.started_at }
      : null,
    recent: recentRes.data.map((w) => {
      const sets = setsByWorkout.get(w.id) ?? [];
      return {
        id: w.id,
        name: tn(w.name),
        startedAt: w.started_at,
        finishedAt: w.finished_at,
        volumeKg: sessionVolume(sets),
        setsDone: sets.length,
      };
    }),
  };
}
