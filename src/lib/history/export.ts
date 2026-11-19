/**
 * Рядки для експорту в Excel — чиста функція (без exceljs і файлів), щоб
 * її можна було перевірити тестами. Route handler лише перекладає рядки
 * в аркуші й стилізує їх.
 */

import { wallClockDate } from "@/lib/dates";
import { exerciseName } from "@/lib/i18n/names";
import { cleanFloat, epley1RM } from "@/lib/metrics";
import { formatWeightValue, kgToUnit, toInputWeight, unitLabel, type WeightUnit } from "@/lib/units";
import type { HistoryWorkout } from "./derive";

export type Cell = string | number | Date | null;
export type Row = Cell[];

export interface ExportLabels {
  workouts: { date: string; day: string; duration: string; sets: string; volume: string; records: string; notes: string };
  sets: { date: string; exercise: string; muscle: string; set: string; weight: string; reps: string; e1rm: string; completed: string };
  records: { exercise: string; result: string; e1rm: string; date: string };
  yes: string;
  no: string;
  muscle: (group: string) => string;
}

export interface ExportSheets {
  workouts: Row[];
  sets: Row[];
  records: Row[];
}

/** Індекси колонок з датою/часом (для формату комірок). */
export const DATE_COLUMNS = { workouts: [0], sets: [0], records: [3] } as const;

/** Вага в одиницях користувача: кг — до 0.01, lb — до 0.5 (як у полях вводу). */
const weightIn = (kg: number, unit: WeightUnit) => toInputWeight(kg, unit);
/** Тоннаж і 1ПМ — до 0.1 в одиницях користувача. */
const round1 = (kg: number, unit: WeightUnit) => cleanFloat(Math.round(kgToUnit(kg, unit) * 10) / 10);

/**
 * Три аркуші: "Тренування", "Підходи", "Рекорди". Перший рядок кожного —
 * заголовки мовою інтерфейсу; одиниці ваги — в назві колонки.
 * Тренування — від найновішого (як в історії).
 */
export function buildExportRows(
  workouts: readonly HistoryWorkout[],
  opts: { unit: WeightUnit; locale: string; labels: ExportLabels },
): ExportSheets {
  const { unit, locale, labels: L } = opts;
  const u = unitLabel(unit, locale);
  const ordered = [...workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const workoutRows: Row[] = [
    [
      L.workouts.date,
      L.workouts.day,
      L.workouts.duration,
      L.workouts.sets,
      `${L.workouts.volume}, ${u}`,
      L.workouts.records,
      L.workouts.notes,
    ],
  ];
  const setRows: Row[] = [
    [
      L.sets.date,
      L.sets.exercise,
      L.sets.muscle,
      L.sets.set,
      `${L.sets.weight}, ${u}`,
      L.sets.reps,
      `${L.sets.e1rm}, ${u}`,
      L.sets.completed,
    ],
  ];
  const recordRows: Row[] = [[L.records.exercise, L.records.result, `${L.records.e1rm}, ${u}`, L.records.date]];

  for (const w of ordered) {
    const date = wallClockDate(w.startedAt);
    workoutRows.push([
      date,
      w.name,
      w.stats.durationMinutes,
      w.stats.setsDone,
      Math.round(kgToUnit(w.stats.volumeKg, unit)),
      w.prCount,
      w.notes || null,
    ]);

    for (const ex of w.exercises) {
      const name = exerciseName(ex, locale);
      let best: { weight: number; reps: number; e1rm: number } | null = null;
      for (const s of ex.sets) {
        setRows.push([
          date,
          name,
          L.muscle(ex.muscleGroup),
          s.setNumber,
          weightIn(s.weight, unit),
          s.reps,
          s.isCompleted ? round1(epley1RM(s.weight, s.reps), unit) : null,
          s.isCompleted ? L.yes : L.no,
        ]);
        if (s.isPR) {
          const e1rm = epley1RM(s.weight, s.reps);
          if (!best || e1rm > best.e1rm) best = { weight: s.weight, reps: s.reps, e1rm };
        }
      }
      if (best) {
        recordRows.push([name, `${formatWeightValue(best.weight, unit, locale)} × ${best.reps}`, round1(best.e1rm, unit), date]);
      }
    }
  }

  return { workouts: workoutRows, sets: setRows, records: recordRows };
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
