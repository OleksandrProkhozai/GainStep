/**
 * Історія тренувань — чисті функції без Supabase, React і поточної дати.
 * Уся «розумна» логіка береться з готових модулів:
 *  - рекорди — markPRs / historyBest (progression.ts), mergeBest (workout/records.ts);
 *  - розвантаження — suggestNextWeight (progression.ts);
 *  - тривалість — workoutDurationMinutes (workout/summary.ts);
 *  - тоннаж і 1ПМ — sessionVolume / epley1RM (metrics.ts).
 */

import { addDays, startOfWeek } from "@/lib/dates";
import { matchesExerciseQuery } from "@/lib/i18n/names";
import { cleanFloat, epley1RM, sessionVolume } from "@/lib/metrics";
import {
  historyBest,
  markPRs,
  suggestNextWeight,
  workingSets,
  type PersonalBest,
  type SetResult,
} from "@/lib/progression";
import { mergeBest, type ExerciseSession } from "@/lib/workout/records";
import { workoutDurationMinutes } from "@/lib/workout/summary";

const EPSILON = 1e-9;

// ───────────────────────────── Типи ─────────────────────────────

/** Параметри прогресії вправи в конкретному тренуванні (з дня програми). */
export interface ProgressionParams {
  repMin: number;
  repMax: number;
  targetSets: number;
  /** Крок ваги, кг. */
  increment: number;
}

/** Тренування вправи з позначками рекордів і розвантаження. */
export interface AnalyzedSession extends ExerciseSession {
  /** Рекордні підходи (та сама довжина й порядок, що й sets). */
  prFlags: boolean[];
  /** Робоча вага не вища за рекомендовану алгоритмом вагу розвантаження. */
  deload: boolean;
}

/** Довідкові дані вправи для показу. */
export interface HistoryExerciseMeta {
  exerciseId: string;
  name: string;
  nameUk: string | null;
  muscleGroup: string;
  imagePath: string | null;
  custom: boolean;
}

export interface HistorySet extends SetResult {
  setNumber: number;
  /** Час позначення виконаним (для редагування). */
  completedAt?: string | null;
  isPR: boolean;
  /** Розрахунковий 1ПМ (Еплі), кг; 0 — для невиконаних. */
  e1rm: number;
}

export interface HistoryExercise extends HistoryExerciseMeta {
  sets: HistorySet[];
  hasPR: boolean;
  deload: boolean;
}

export interface WorkoutStats {
  /** Хвилини; null — немає finished_at. */
  durationMinutes: number | null;
  /** Тоннаж виконаних підходів, кг. */
  volumeKg: number;
  /** Кількість виконаних підходів. */
  setsDone: number;
}

export interface HistoryWorkout {
  id: string;
  /** Назва дня програми мовою інтерфейсу. */
  name: string;
  programId: string | null;
  programDayId: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string;
  /** Календарний день у поясі користувача. */
  dayKey: string;
  exercises: HistoryExercise[];
  stats: WorkoutStats;
  /** Кількість вправ з рекордом (як на підсумку й дашборді). */
  prCount: number;
  deload: boolean;
}

/** Тренування з бази до аналізу (підходи — за номером). */
export interface RawHistoryWorkout {
  id: string;
  name: string;
  programId: string | null;
  programDayId: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  dayKey: string;
  exercises: { meta: HistoryExerciseMeta; sets: (SetResult & { setNumber: number; completedAt?: string | null })[] }[];
}

// ───────────────────────────── Статистика ─────────────────────────────

/** Тривалість, тоннаж і кількість підходів — лише виконані підходи. */
export function workoutStats(input: {
  startedAt: string;
  finishedAt: string | null;
  sets: readonly SetResult[];
}): WorkoutStats {
  const done = input.sets.filter((s) => s.isCompleted);
  return {
    durationMinutes: workoutDurationMinutes(input.startedAt, input.finishedAt),
    volumeKg: sessionVolume(done),
    setsDone: done.length,
  };
}

// ───────────────────────────── Рекорди й розвантаження ─────────────────────────────

/**
 * Тренування однієї вправи (у будь-якому порядку) → від найстарішого,
 * з позначками рекордів і розвантаження.
 * - Кожне тренування порівнюється лише з історією ДО нього, тож перше
 *   тренування з вправою рекордів не дає (як в алгоритмі).
 * - Розвантаження рахується лише для тренувань, для яких `paramsFor`
 *   повертає параметри: рекомендація suggestNextWeight за попередньою
 *   історією = 'deload', і робоча вага не вища за рекомендовану.
 */
export function analyzeExerciseSessions(
  sessions: readonly ExerciseSession[],
  paramsFor?: (workoutId: string) => ProgressionParams | null | undefined,
): AnalyzedSession[] {
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  let best: PersonalBest | null = null;
  return ordered.map((session, i) => {
    const prFlags = markPRs(session.sets, best);
    let deload = false;
    const params = paramsFor?.(session.workoutId);
    if (params) {
      const history = ordered
        .slice(0, i)
        .reverse()
        .map((s) => ({ sets: s.sets }));
      const suggestion = suggestNextWeight({ history, ...params });
      const today = workingSets(session)?.weight;
      deload =
        suggestion.action === "deload" &&
        suggestion.weight !== null &&
        today !== undefined &&
        today <= suggestion.weight + EPSILON;
    }
    best = mergeBest(best, historyBest([session]));
    return { ...session, prFlags, deload };
  });
}

/** Тренування з бази + аналіз історії його вправ → картка історії. */
export function assembleWorkout(
  raw: RawHistoryWorkout,
  analysis: ReadonlyMap<string, readonly AnalyzedSession[]>,
): HistoryWorkout {
  const exercises: HistoryExercise[] = raw.exercises.map(({ meta, sets }) => {
    const session = analysis.get(meta.exerciseId)?.find((s) => s.workoutId === raw.id);
    // Підходи в аналізі й тут — ті самі рядки за set_number, тож індекси збігаються.
    const aligned = session?.sets.length === sets.length ? session : undefined;
    const historySets = sets.map((s, i) => ({
      ...s,
      isPR: aligned?.prFlags[i] ?? false,
      e1rm: s.isCompleted ? epley1RM(s.weight, s.reps) : 0,
    }));
    return {
      ...meta,
      sets: historySets,
      hasPR: historySets.some((s) => s.isPR),
      deload: aligned?.deload ?? false,
    };
  });

  return {
    id: raw.id,
    name: raw.name,
    programId: raw.programId,
    programDayId: raw.programDayId,
    startedAt: raw.startedAt,
    finishedAt: raw.finishedAt,
    notes: raw.notes ?? "",
    dayKey: raw.dayKey,
    exercises,
    stats: workoutStats({
      startedAt: raw.startedAt,
      finishedAt: raw.finishedAt,
      sets: exercises.flatMap((e) => e.sets),
    }),
    prCount: exercises.filter((e) => e.hasPR).length,
    deload: exercises.some((e) => e.deload),
  };
}

// ───────────────────────────── Місяць ─────────────────────────────

export interface MonthSummary {
  workouts: number;
  volumeKg: number;
  records: number;
}

/** Підсумок місяця: кількість тренувань, тоннаж, рекорди (вправи з рекордом). */
export function monthSummary(workouts: readonly Pick<HistoryWorkout, "stats" | "prCount">[]): MonthSummary {
  return {
    workouts: workouts.length,
    volumeKg: cleanFloat(workouts.reduce((sum, w) => sum + w.stats.volumeKg, 0)),
    records: workouts.reduce((sum, w) => sum + w.prCount, 0),
  };
}

// ───────────────────────────── Тижні ─────────────────────────────

export type WeekKind = "this" | "last" | "earlier";

export interface WeekGroup<T> {
  /** Понеділок тижня ("YYYY-MM-DD"). */
  weekStart: string;
  /** Неділя тижня. */
  weekEnd: string;
  kind: WeekKind;
  workouts: T[];
}

/**
 * Групування по тижнях (з понеділка) відносно `today`: "this" — поточний
 * тиждень, "last" — попередній, решта — "earlier" (показується діапазоном
 * дат). Тижні й тренування в них — від найновіших.
 */
export function groupByWeek<T extends { dayKey: string; startedAt: string }>(
  workouts: readonly T[],
  today: string,
): WeekGroup<T>[] {
  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);
  const groups = new Map<string, T[]>();
  for (const w of workouts) {
    const key = startOfWeek(w.dayKey);
    const list = groups.get(key);
    if (list) list.push(w);
    else groups.set(key, [w]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, list]) => ({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      kind: weekStart === thisWeek ? "this" : weekStart === lastWeek ? "last" : "earlier",
      workouts: [...list].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    }));
}

// ───────────────────────────── Останні рекорди ─────────────────────────────

export interface RecentRecord {
  exerciseId: string;
  workoutId: string;
  startedAt: string;
  weight: number;
  reps: number;
  e1rm: number;
}

/**
 * Останні рекорди: для кожного тренування кожної вправи — найкращий
 * рекордний підхід (за 1ПМ); від найновішого, не більше `limit`.
 */
export function recentRecords(
  analysis: ReadonlyMap<string, readonly AnalyzedSession[]> | Iterable<[string, readonly AnalyzedSession[]]>,
  limit = 3,
): RecentRecord[] {
  const all: RecentRecord[] = [];
  for (const [exerciseId, sessions] of analysis) {
    for (const session of sessions) {
      let best: RecentRecord | null = null;
      for (let i = 0; i < session.sets.length; i++) {
        if (!session.prFlags[i]) continue;
        const set = session.sets[i];
        const e1rm = epley1RM(set.weight, set.reps);
        if (!best || e1rm > best.e1rm) {
          best = { exerciseId, workoutId: session.workoutId, startedAt: session.startedAt, weight: set.weight, reps: set.reps, e1rm };
        }
      }
      if (best) all.push(best);
    }
  }
  return all
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.e1rm - a.e1rm)
    .slice(0, Math.max(0, limit));
}

// ───────────────────────────── Фільтри ─────────────────────────────

export interface HistoryFilters {
  programId?: string | null;
  exerciseId?: string | null;
  /** Пошук по назві дня, вправах і нотатці. */
  q?: string | null;
  /** Один день календаря ("YYYY-MM-DD"). */
  day?: string | null;
}

/** Чи є хоч один активний фільтр. */
export function hasActiveFilters(f: HistoryFilters) {
  return Boolean(f.programId || f.exerciseId || f.q?.trim() || f.day);
}

/** Фільтрація тренувань (на сервері, за параметрами URL). */
export function filterWorkouts<T extends Pick<HistoryWorkout, "programId" | "name" | "notes" | "dayKey" | "exercises">>(
  workouts: readonly T[],
  filters: HistoryFilters,
): T[] {
  const q = filters.q?.trim().toLocaleLowerCase() ?? "";
  return workouts.filter((w) => {
    if (filters.programId && w.programId !== filters.programId) return false;
    if (filters.exerciseId && !w.exercises.some((e) => e.exerciseId === filters.exerciseId)) return false;
    if (filters.day && w.dayKey !== filters.day) return false;
    if (q) {
      const inName = w.name.toLocaleLowerCase().includes(q);
      const inNotes = w.notes.toLocaleLowerCase().includes(q);
      const inExercises = w.exercises.some((e) => matchesExerciseQuery({ name: e.name, nameUk: e.nameUk }, q));
      if (!inName && !inNotes && !inExercises) return false;
    }
    return true;
  });
}
