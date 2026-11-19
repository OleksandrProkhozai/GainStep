import type { ExerciseSession } from "./records";

/** Рядок workout_sets разом з датою тренування (як його повертає запит історії). */
export interface SessionRow {
  exerciseId: string;
  workoutId: string;
  startedAt: string;
  setNumber: number;
  weight: number;
  reps: number;
  isCompleted: boolean;
}

/**
 * Групування плоских рядків історії: вправа → тренування (від найновішого)
 * → підходи (за номером). Чиста функція — використовується в
 * loadExerciseSessions і тестується окремо.
 */
export function groupSessionRows(rows: readonly SessionRow[]): Map<string, ExerciseSession[]> {
  const grouped = new Map<
    string,
    Map<string, { startedAt: string; sets: { n: number; set: ExerciseSession["sets"][number] }[] }>
  >();
  for (const row of rows) {
    let byWorkout = grouped.get(row.exerciseId);
    if (!byWorkout) grouped.set(row.exerciseId, (byWorkout = new Map()));
    let session = byWorkout.get(row.workoutId);
    if (!session) {
      session = { startedAt: row.startedAt, sets: [] };
      byWorkout.set(row.workoutId, session);
    }
    session.sets.push({
      n: row.setNumber,
      set: { weight: row.weight, reps: row.reps, isCompleted: row.isCompleted },
    });
  }

  const result = new Map<string, ExerciseSession[]>();
  for (const [exerciseId, byWorkout] of grouped) {
    result.set(
      exerciseId,
      [...byWorkout.entries()]
        .sort(([, a], [, b]) => b.startedAt.localeCompare(a.startedAt))
        .map(([workoutId, s]) => ({
          workoutId,
          startedAt: s.startedAt,
          sets: s.sets.sort((a, b) => a.n - b.n).map((x) => x.set),
        })),
    );
  }
  return result;
}
