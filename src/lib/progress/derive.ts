/**
 * Розрахунки для сторінки "Progress". Чисті функції (без React, Supabase
 * і поточної дати), тож однаково працюють на сервері, клієнті й у тестах.
 * Усі ваги — в кг.
 */

import { addDays, startOfWeek, toDayKey } from "@/lib/dates";
import { cleanFloat, epley1RM, setVolume } from "@/lib/metrics";

/** Виконаний підхід завершеного тренування. */
export interface ProgressSet {
  exerciseId: string;
  exerciseName: string;
  workoutId: string;
  /** Початок тренування, ISO. */
  startedAt: string;
  weight: number;
  reps: number;
}

export type WeightChange = "increase" | "deload";

/** Одне тренування з історії вправи. */
export interface ExerciseSession {
  /** Початок тренування, мс від епохи. */
  t: number;
  /** Робоча вага — найбільша вага серед підходів тренування, кг. */
  workingWeight: number;
  /** Підхід із найбільшим розрахунковим 1ПМ. */
  bestSet: { weight: number; reps: number };
  /** Найбільший розрахунковий 1ПМ (Еплі) за тренування, кг. */
  e1rm: number;
  /** Зміна робочої ваги відносно попереднього тренування. */
  change: WeightChange | null;
}

export interface ExerciseHistory {
  id: string;
  name: string;
  /** Від найстарішого до найновішого. */
  sessions: ExerciseSession[];
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  e1rm: number;
  /** Коли рекорд встановлено вперше, мс від епохи. */
  t: number;
}

export interface WeekVolume {
  /** Понеділок тижня, "YYYY-MM-DD". */
  week: string;
  volumeKg: number;
}

/**
 * Історія кожної вправи по тренуваннях. Підходи без ваги або повторень
 * (вправи з власною вагою) пропускаються: для них немає ні робочої ваги,
 * ні 1ПМ. Вправи впорядковано за кількістю тренувань (найчастіші — першими).
 */
export function buildExerciseHistories(sets: readonly ProgressSet[]): ExerciseHistory[] {
  const byExercise = new Map<
    string,
    { name: string; workouts: Map<string, { t: number; sets: ProgressSet[] }> }
  >();

  for (const s of sets) {
    if (!(s.weight > 0) || !(s.reps > 0)) continue;
    let exercise = byExercise.get(s.exerciseId);
    if (!exercise) {
      exercise = { name: s.exerciseName, workouts: new Map() };
      byExercise.set(s.exerciseId, exercise);
    }
    let workout = exercise.workouts.get(s.workoutId);
    if (!workout) {
      workout = { t: new Date(s.startedAt).getTime(), sets: [] };
      exercise.workouts.set(s.workoutId, workout);
    }
    workout.sets.push(s);
  }

  const histories: ExerciseHistory[] = [];
  for (const [id, exercise] of byExercise) {
    const workouts = [...exercise.workouts.values()].sort((a, b) => a.t - b.t);
    const sessions: ExerciseSession[] = [];
    for (const w of workouts) {
      let best = w.sets[0];
      let bestE1rm = epley1RM(best.weight, best.reps);
      let workingWeight = 0;
      for (const s of w.sets) {
        workingWeight = Math.max(workingWeight, s.weight);
        const e1rm = epley1RM(s.weight, s.reps);
        if (e1rm > bestE1rm || (e1rm === bestE1rm && s.weight > best.weight)) {
          best = s;
          bestE1rm = e1rm;
        }
      }
      const prev = sessions.at(-1);
      const diff = prev ? cleanFloat(workingWeight - prev.workingWeight) : 0;
      sessions.push({
        t: w.t,
        workingWeight,
        bestSet: { weight: best.weight, reps: best.reps },
        e1rm: bestE1rm,
        change: diff > 0 ? "increase" : diff < 0 ? "deload" : null,
      });
    }
    histories.push({ id, name: exercise.name, sessions });
  }

  return histories.sort(
    (a, b) => b.sessions.length - a.sessions.length || a.name.localeCompare(b.name),
  );
}

/** Показник із зміною відносно першого тренування періоду (null — не з чим порівняти). */
export interface StatWithDelta {
  value: number;
  delta: number | null;
}

export interface RangeSummary {
  sessions: ExerciseSession[];
  workingWeight: StatWithDelta | null;
  e1rm: StatWithDelta | null;
  bestSet: { weight: number; reps: number; e1rm: number } | null;
}

/**
 * Підсумок вправи за період: останні робоча вага й 1ПМ зі зміною від
 * першого тренування періоду, найкращий підхід і самі тренування.
 * @param from початок періоду, мс; null — уся історія
 */
export function summarizeRange(
  sessions: readonly ExerciseSession[],
  from: number | null,
): RangeSummary {
  const visible = from === null ? [...sessions] : sessions.filter((s) => s.t >= from);
  const first = visible[0];
  const last = visible.at(-1);
  if (!first || !last) {
    return { sessions: visible, workingWeight: null, e1rm: null, bestSet: null };
  }
  const hasDelta = visible.length > 1;

  let best = first;
  for (const s of visible) {
    if (s.e1rm > best.e1rm || (s.e1rm === best.e1rm && s.bestSet.weight > best.bestSet.weight)) {
      best = s;
    }
  }

  return {
    sessions: visible,
    workingWeight: {
      value: last.workingWeight,
      delta: hasDelta ? cleanFloat(last.workingWeight - first.workingWeight) : null,
    },
    e1rm: {
      value: last.e1rm,
      delta: hasDelta ? cleanFloat(last.e1rm - first.e1rm) : null,
    },
    bestSet: { ...best.bestSet, e1rm: best.e1rm },
  };
}

/**
 * Особисті рекорди: для кожної вправи — підхід із найбільшим 1ПМ за всю
 * історію (за рівного 1ПМ — той, що встановлено раніше). Найсвіжіші — першими.
 */
export function personalRecords(histories: readonly ExerciseHistory[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  for (const h of histories) {
    let best: ExerciseSession | undefined;
    for (const s of h.sessions) {
      if (!best || s.e1rm > best.e1rm) best = s;
    }
    if (!best) continue;
    records.push({
      exerciseId: h.id,
      name: h.name,
      weight: best.bestSet.weight,
      reps: best.bestSet.reps,
      e1rm: best.e1rm,
      t: best.t,
    });
  }
  return records.sort((a, b) => b.t - a.t || b.e1rm - a.e1rm);
}

/**
 * Тоннаж по тижнях (з понеділка, у поясі користувача) за останні `weeks`
 * тижнів, включно з поточним. Від найстарішого до поточного.
 */
export function weeklyVolume(
  sets: readonly Pick<ProgressSet, "startedAt" | "weight" | "reps">[],
  now: Date,
  weeks = 8,
): WeekVolume[] {
  const current = startOfWeek(toDayKey(now));
  const result: WeekVolume[] = [];
  const index = new Map<string, number>();
  for (let i = weeks - 1; i >= 0; i--) {
    const week = addDays(current, -7 * i);
    index.set(week, result.length);
    result.push({ week, volumeKg: 0 });
  }
  for (const s of sets) {
    const i = index.get(startOfWeek(toDayKey(s.startedAt)));
    if (i !== undefined) result[i].volumeKg += setVolume(s.weight, s.reps);
  }
  for (const w of result) w.volumeKg = cleanFloat(w.volumeKg);
  return result;
}

/** Зміна у відсотках (ціле число); null, якщо попереднє значення нульове. */
export function percentChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}
