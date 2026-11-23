import { createWorkout, saveExercisePlan } from "./actions";
import type { CreateWorkoutRow, SavePlan } from "./sync";

/** Склад тренування → server action; помилка (і офлайн) — throw, черга повторить. */
export const savePlan: SavePlan = async (workoutId, plan) => {
  const result = await saveExercisePlan(workoutId, plan);
  if (!result.ok) throw new Error(result.error);
};

/** Рядок тренування, почато без мережі → server action; помилка — throw, черга повторить. */
export const createWorkoutRow: CreateWorkoutRow = async (input) => {
  const result = await createWorkout(input);
  if (!result.ok) throw new Error(result.error);
};
