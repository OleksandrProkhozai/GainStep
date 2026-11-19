/**
 * Підсумок завершеного тренування — чиста функція без Supabase і React.
 * Уся «розумна» логіка береться з готових модулів:
 *  - рекомендація на наступний раз — suggestNextWeight (progression.ts);
 *  - рекорди — historyBest / markPRs (progression.ts);
 *  - 1ПМ і тоннаж — epley1RM / sessionVolume (metrics.ts).
 * Тут лише збирання цих результатів у структуру для екрана підсумку.
 */

import { epley1RM, sessionVolume, type VolumeSet } from "@/lib/metrics";
import {
  historyBest,
  markPRs,
  suggestNextWeight,
  workingSets,
  type PersonalBest,
  type Session,
  type SetResult,
  type Suggestion,
} from "@/lib/progression";
import { countPRExercises, type ExercisePRInput } from "./records";

// ───────────────────────────── Вхід ─────────────────────────────

/** Вправа тренування з параметрами прогресії та історією ДО цього тренування. */
export interface SummaryExerciseInput {
  exerciseId: string;
  name: string;
  /** Група м'язів — для мініатюри. */
  muscleGroup?: string;
  repMin: number;
  repMax: number;
  targetSets: number;
  /** Крок ваги, кг. */
  increment: number;
  /**
   * Завершені тренування з цією вправою, що були ДО поточного
   * (від найновішого). Алгоритму прогресії досить двох останніх.
   */
  history: readonly Session[];
  /**
   * Найкращі показники за всю попередню історію. Якщо не передано —
   * рахуються з `history` (зручно в тестах).
   */
  best?: PersonalBest | null;
}

/** Підхід поточного тренування. */
export interface SummarySetInput extends SetResult {
  exerciseId: string;
}

export interface SummaryInput {
  startedAt: string;
  finishedAt: string | null;
  /** Вправи в порядку показу. */
  exercises: readonly SummaryExerciseInput[];
  /** Підходи тренування в порядку виконання (для кожної вправи — за номером). */
  sets: readonly SummarySetInput[];
  /** Попереднє завершене тренування того самого дня програми (або null). */
  previous: { sets: readonly VolumeSet[] } | null;
}

// ───────────────────────────── Вихід ─────────────────────────────

/** Рекомендація на наступний раз + робоча вага цього тренування. */
export interface NextTime extends Suggestion {
  /** Робоча вага цього тренування, кг (null — якщо виконаних підходів немає). */
  today: number | null;
}

export interface SummarySet extends SetResult {
  isPR: boolean;
}

export interface SummaryRecord {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  /** Розрахунковий 1ПМ рекордного підходу, кг. */
  e1rm: number;
}

export interface SummaryExercise {
  exerciseId: string;
  name: string;
  muscleGroup?: string;
  repMin: number;
  repMax: number;
  /** Лише виконані підходи. */
  sets: SummarySet[];
  /** Найкращий 1ПМ за тренування, кг. */
  bestE1RM: number;
  /** Найкращий рекордний підхід (null — рекорду немає). */
  record: SummaryRecord | null;
  next: NextTime;
}

export interface WorkoutSummary {
  /** Тривалість у хвилинах (null — немає finished_at). */
  durationMinutes: number | null;
  volumeKg: number;
  setsDone: number;
  /** Кількість вправ з новим рекордом. */
  prCount: number;
  /** Зміна тоннажу у % відносно попереднього такого самого дня; null — порівнювати нема з чим. */
  volumeChange: number | null;
  exercises: SummaryExercise[];
  /** Рекордні вправи, від найбільшого 1ПМ. */
  records: SummaryRecord[];
}

// ───────────────────────────── Розрахунок ─────────────────────────────

/** Тривалість тренування, хв (округлено, не менше 0). */
export function workoutDurationMinutes(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) return null;
  const ms = Date.parse(finishedAt) - Date.parse(startedAt);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60_000)) : null;
}

/** Зміна тоннажу у %; null, якщо попереднього тренування немає або його тоннаж 0. */
export function volumeChangePercent(current: number, previous: number | null) {
  if (previous === null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Підсумок завершеного тренування.
 * - Рекорди порівнюються лише з історією ДО цього тренування (markPRs),
 *   тож підхід не може бути рекордом «проти самого себе».
 * - "Next time" — suggestNextWeight з історією [це тренування, ...попередні],
 *   тобто рекомендація, актуальна ПІСЛЯ цього тренування.
 * - Вправи без жодного виконаного підходу в підсумок не потрапляють.
 */
export function buildWorkoutSummary(input: SummaryInput): WorkoutSummary {
  const done = input.sets.filter((s) => s.isCompleted);
  const volumeKg = sessionVolume(done);
  const previousVolume = input.previous ? sessionVolume(input.previous.sets) : null;

  const exercises: SummaryExercise[] = [];
  const prInputs: ExercisePRInput[] = [];
  for (const ex of input.exercises) {
    const own: SetResult[] = done
      .filter((s) => s.exerciseId === ex.exerciseId)
      .map(({ weight, reps, isCompleted }) => ({ weight, reps, isCompleted }));
    if (own.length === 0) continue;

    const best = ex.best === undefined ? historyBest(ex.history) : ex.best;
    prInputs.push({ sets: own, best });
    const flags = markPRs(own, best);
    const sets = own.map((s, i) => ({ ...s, isPR: flags[i] }));

    let record: SummaryRecord | null = null;
    for (const s of sets) {
      if (!s.isPR) continue;
      const e1rm = epley1RM(s.weight, s.reps);
      if (!record || e1rm > record.e1rm) {
        record = { exerciseId: ex.exerciseId, name: ex.name, weight: s.weight, reps: s.reps, e1rm };
      }
    }

    const current: Session = { sets: own };
    const suggestion = suggestNextWeight({
      history: [current, ...ex.history],
      repMin: ex.repMin,
      repMax: ex.repMax,
      targetSets: ex.targetSets,
      increment: ex.increment,
    });

    exercises.push({
      exerciseId: ex.exerciseId,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      repMin: ex.repMin,
      repMax: ex.repMax,
      sets,
      bestE1RM: Math.max(0, ...own.map((s) => epley1RM(s.weight, s.reps))),
      record,
      next: { ...suggestion, today: workingSets(current)?.weight ?? null },
    });
  }

  const records = exercises
    .map((e) => e.record)
    .filter((r): r is SummaryRecord => r !== null)
    .sort((a, b) => b.e1rm - a.e1rm);

  return {
    durationMinutes: workoutDurationMinutes(input.startedAt, input.finishedAt),
    volumeKg,
    setsDone: done.length,
    prCount: countPRExercises(prInputs),
    volumeChange: volumeChangePercent(volumeKg, previousVolume),
    exercises,
    records,
  };
}
