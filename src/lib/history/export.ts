/**
 * Рядки для експорту в Excel — чиста функція (без exceljs і файлів), щоб
 * її можна було перевірити тестами. xlsx.ts лише перекладає рядки
 * в аркуші й стилізує їх (за `journalStyle`).
 */

import { wallClockDate } from "@/lib/dates";
import { exerciseName } from "@/lib/i18n/names";
import { cleanFloat, epley1RM, setVolume } from "@/lib/metrics";
import { workingSets } from "@/lib/progression";
import { formatWeightValue, kgToUnit, toInputWeight, unitLabel, type WeightUnit } from "@/lib/units";
import type { HistoryWorkout } from "./derive";

export type Cell = string | number | Date | null;
export type Row = Cell[];

export interface ExportLabels {
  journal: {
    date: string;
    day: string;
    exercise: string;
    muscle: string;
    equipment: string;
    set: string;
    weight: string;
    reps: string;
    setVolume: string;
    e1rm: string;
    record: string;
    completed: string;
    notes: string;
  };
  workouts: {
    date: string;
    day: string;
    duration: string;
    exercises: string;
    sets: string;
    volume: string;
    heaviest: string;
    records: string;
    notes: string;
  };
  records: { exercise: string; result: string; e1rm: string; date: string };
  exercises: {
    exercise: string;
    first: string;
    last: string;
    workouts: string;
    best: string;
    bestE1rm: string;
    startWeight: string;
    currentWeight: string;
    gain: string;
    gainPct: string;
  };
  yes: string;
  no: string;
  /** Позначка рекордного підходу в журналі ("🏆 Рекорд"). */
  recordMark: string;
  muscle: (group: string) => string;
  equipment: (equipment: string) => string;
}

/** Порядок аркушів у файлі: Excel відкривається на першому — журналі підходів. */
export const SHEET_ORDER = ["journal", "workouts", "records", "exercises"] as const;
export type SheetKey = (typeof SHEET_ORDER)[number];

/** Оформлення рядка журналу (без заголовка; той самий порядок, що й рядки). */
export interface JournalRowStyle {
  /** Перший рядок тренування — верхня рамка-розділювач. */
  firstOfWorkout: boolean;
  /** Тренування через одне — затінений блок рядків. */
  shaded: boolean;
  pr: boolean;
  completed: boolean;
  /** Робочий підхід вправи, яку алгоритм позначив розвантаженням. */
  deload: boolean;
  /** Група м'язів (ключ enum) — для кольору комірки. */
  muscleGroup: string;
}

export type ExportSheets = Record<SheetKey, Row[]> & { journalStyle: JournalRowStyle[] };

/** Індекси колонок з датою/часом (для формату комірок). */
export const DATE_COLUMNS: Record<SheetKey, readonly number[]> = {
  journal: [0],
  workouts: [0],
  records: [3],
  exercises: [1, 2],
};

/** Індекси колонок (з 0), які оформлюються окремо. */
export const COLUMNS = {
  journal: { date: 0, day: 1, muscle: 3, weight: 6, setVolume: 8, e1rm: 9 },
  /** duration — частка доби (формат [h]:mm). */
  workouts: { label: 0, duration: 2, sets: 4, volume: 5, records: 7 },
  records: { e1rm: 2 },
  exercises: { gain: 8, gainPct: 9 },
} as const;

/** Вага в одиницях користувача: кг — до 0.01, lb — до 0.5 (як у полях вводу). */
const weightIn = (kg: number, unit: WeightUnit) => toInputWeight(kg, unit);
/** Тоннаж і 1ПМ — до 0.1 в одиницях користувача. */
const round1 = (kg: number, unit: WeightUnit) => cleanFloat(Math.round(kgToUnit(kg, unit) * 10) / 10);
/** Хвилини → частка доби (час у Excel). */
const minutesToDays = (minutes: number) => minutes / 1440;

interface ExerciseProgress {
  name: string;
  first: Date;
  last: Date;
  workouts: number;
  best: { weight: number; reps: number; e1rm: number } | null;
  startWeight: number | null;
  currentWeight: number | null;
}

/**
 * Чотири аркуші (у порядку SHEET_ORDER):
 *  - "Журнал" — один рядок = один підхід, від старих до нових;
 *  - "Тренування" — підсумок кожного тренування, від найновішого;
 *  - "Рекорди" — найкращий рекордний підхід вправи в тренуванні;
 *  - "Вправи" — прогрес кожної вправи за період експорту.
 * Перший рядок кожного — заголовки мовою інтерфейсу; одиниці ваги — в назві колонки.
 */
export function buildExportRows(
  workouts: readonly HistoryWorkout[],
  opts: { unit: WeightUnit; locale: string; labels: ExportLabels },
): ExportSheets {
  const { unit, locale, labels: L } = opts;
  const u = unitLabel(unit, locale);
  const oldestFirst = [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const newestFirst = [...oldestFirst].reverse();

  // ── Журнал ──
  const J = L.journal;
  const journal: Row[] = [
    [
      J.date,
      J.day,
      J.exercise,
      J.muscle,
      J.equipment,
      J.set,
      `${J.weight}, ${u}`,
      J.reps,
      `${J.setVolume}, ${u}`,
      `${J.e1rm}, ${u}`,
      J.record,
      J.completed,
      J.notes,
    ],
  ];
  const journalStyle: JournalRowStyle[] = [];
  const progress = new Map<string, ExerciseProgress>();

  oldestFirst.forEach((w, wi) => {
    const date = wallClockDate(w.startedAt);
    let first = true;
    for (const ex of w.exercises) {
      const name = exerciseName(ex, locale);
      const working = workingSets({ sets: ex.sets });
      // Розвантаження (робоча вага ≤ рекомендованої алгоритмом, derive.ts) — підсвічуємо робочі підходи.
      const deloadWeight = ex.deload && working ? working.weight : null;
      for (const s of ex.sets) {
        journal.push([
          date,
          w.name,
          name,
          L.muscle(ex.muscleGroup),
          ex.equipment ? L.equipment(ex.equipment) : null,
          s.setNumber,
          weightIn(s.weight, unit),
          s.reps,
          s.isCompleted ? round1(setVolume(s.weight, s.reps), unit) : null,
          s.isCompleted ? round1(epley1RM(s.weight, s.reps), unit) : null,
          s.isPR ? L.recordMark : null,
          s.isCompleted ? L.yes : L.no,
          first ? w.notes || null : null,
        ]);
        journalStyle.push({
          firstOfWorkout: first,
          shaded: wi % 2 === 1,
          pr: s.isPR,
          completed: s.isCompleted,
          deload: deloadWeight !== null && s.isCompleted && s.weight === deloadWeight,
          muscleGroup: ex.muscleGroup,
        });
        first = false;
      }

      // Прогрес вправи: тренування рахуються від старих, тож перше — початок.
      let p = progress.get(ex.exerciseId);
      if (!p) {
        p = { name, first: date, last: date, workouts: 0, best: null, startWeight: null, currentWeight: null };
        progress.set(ex.exerciseId, p);
      }
      p.last = date;
      p.workouts += 1;
      if (working) {
        p.startWeight ??= working.weight;
        p.currentWeight = working.weight;
      }
      for (const s of ex.sets) {
        if (!s.isCompleted) continue;
        const e1rm = epley1RM(s.weight, s.reps);
        if (!p.best || e1rm > p.best.e1rm) p.best = { weight: s.weight, reps: s.reps, e1rm };
      }
    }
  });

  // ── Тренування й рекорди ──
  const W = L.workouts;
  const workoutRows: Row[] = [
    [
      W.date,
      W.day,
      W.duration,
      W.exercises,
      W.sets,
      `${W.volume}, ${u}`,
      `${W.heaviest}, ${u}`,
      W.records,
      W.notes,
    ],
  ];
  const recordRows: Row[] = [[L.records.exercise, L.records.result, `${L.records.e1rm}, ${u}`, L.records.date]];

  for (const w of newestFirst) {
    const date = wallClockDate(w.startedAt);
    const doneWeights = w.exercises.flatMap((e) => e.sets.filter((s) => s.isCompleted).map((s) => s.weight));
    workoutRows.push([
      date,
      w.name,
      w.stats.durationMinutes === null ? null : minutesToDays(w.stats.durationMinutes),
      w.exercises.length,
      w.stats.setsDone,
      Math.round(kgToUnit(w.stats.volumeKg, unit)),
      doneWeights.length > 0 ? weightIn(Math.max(...doneWeights), unit) : null,
      w.prCount,
      w.notes || null,
    ]);

    for (const ex of w.exercises) {
      let best: { weight: number; reps: number; e1rm: number } | null = null;
      for (const s of ex.sets) {
        if (!s.isPR) continue;
        const e1rm = epley1RM(s.weight, s.reps);
        if (!best || e1rm > best.e1rm) best = { weight: s.weight, reps: s.reps, e1rm };
      }
      if (best) {
        recordRows.push([
          exerciseName(ex, locale),
          `${formatWeightValue(best.weight, unit, locale)} × ${best.reps}`,
          round1(best.e1rm, unit),
          date,
        ]);
      }
    }
  }

  // ── Вправи ──
  const E = L.exercises;
  const exerciseRows: Row[] = [
    [
      E.exercise,
      E.first,
      E.last,
      E.workouts,
      E.best,
      `${E.bestE1rm}, ${u}`,
      `${E.startWeight}, ${u}`,
      `${E.currentWeight}, ${u}`,
      `${E.gain}, ${u}`,
      E.gainPct,
    ],
  ];
  const collator = new Intl.Collator(locale);
  for (const p of [...progress.values()].sort((a, b) => collator.compare(a.name, b.name))) {
    const hasGain = p.startWeight !== null && p.currentWeight !== null;
    const gainKg = hasGain ? p.currentWeight! - p.startWeight! : null;
    exerciseRows.push([
      p.name,
      p.first,
      p.last,
      p.workouts,
      p.best ? `${formatWeightValue(p.best.weight, unit, locale)} × ${p.best.reps}` : null,
      p.best ? round1(p.best.e1rm, unit) : null,
      p.startWeight === null ? null : weightIn(p.startWeight, unit),
      p.currentWeight === null ? null : weightIn(p.currentWeight, unit),
      gainKg === null ? null : round1(gainKg, unit),
      gainKg === null || p.startWeight! <= 0 ? null : cleanFloat(Math.round((gainKg / p.startWeight!) * 1000) / 10),
    ]);
  }

  return { journal, workouts: workoutRows, records: recordRows, exercises: exerciseRows, journalStyle };
}

/** Ширина колонок за найдовшим значенням (у символах), 8–60. */
export function columnWidths(rows: readonly Row[], dateWidth = 17): number[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = cell instanceof Date ? dateWidth : cell === null ? 0 : String(cell).length;
      widths[i] = Math.max(widths[i] ?? 0, len);
    });
  }
  return widths.map((w) => Math.min(60, Math.max(8, w + 2)));
}

/** "gainstep-workouts-2026-11.xlsx" / "gainstep-workouts-all.xlsx". */
export function exportFileName(month: string | null) {
  return `gainstep-workouts-${month ?? "all"}.xlsx`;
}
