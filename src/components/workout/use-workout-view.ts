"use client";

import { useMemo } from "react";
import {
  bestE1RMToday,
  getSuggestion,
  nextPendingSet,
  prIds,
  setsOf,
  workoutStats,
} from "@/lib/workout/derive";
import { useScreen, useWorkout } from "./context";

/** Похідні дані поточної вправи (рахуються з полів стору через useMemo). */
export function useCurrentExercise() {
  const exercises = useWorkout((s) => s.exercises);
  const sets = useWorkout((s) => s.sets);
  const index = useWorkout((s) => s.currentIndex);
  const expandedSetId = useWorkout((s) => s.expandedSetId);
  const { unit } = useScreen();

  return useMemo(() => {
    const exercise = exercises[Math.min(index, exercises.length - 1)] ?? null;
    if (!exercise) return null;
    const own = setsOf(sets, exercise.exerciseId);
    const pending = own.find((s) => !s.isCompleted) ?? null;
    const expanded = own.find((s) => s.clientId === expandedSetId) ?? null;
    return {
      exercise,
      index,
      total: exercises.length,
      isLast: index >= exercises.length - 1,
      sets: own,
      suggestion: getSuggestion(exercise, unit),
      prs: prIds(exercise, sets),
      /** Підхід, з яким працює користувач: розгорнутий або перший невиконаний. */
      activeSet: expanded ?? pending,
      allDone: own.length > 0 && pending === null,
      e1rm: bestE1RMToday(own),
    };
  }, [exercises, sets, index, expandedSetId, unit]);
}

export type CurrentExercise = NonNullable<ReturnType<typeof useCurrentExercise>>;

export function useWorkoutStats() {
  const exercises = useWorkout((s) => s.exercises);
  const sets = useWorkout((s) => s.sets);
  return useMemo(() => workoutStats(exercises, sets), [exercises, sets]);
}

/** Наступний підхід для таймера відпочинку. */
export function useNextSet() {
  const exercises = useWorkout((s) => s.exercises);
  const sets = useWorkout((s) => s.sets);
  const index = useWorkout((s) => s.currentIndex);
  return useMemo(() => nextPendingSet(exercises, sets, index), [exercises, sets, index]);
}

/** Прогрес по кожній вправі для списку. */
export function useExerciseProgress() {
  const exercises = useWorkout((s) => s.exercises);
  const sets = useWorkout((s) => s.sets);
  return useMemo(
    () =>
      exercises.map((exercise) => {
        const own = setsOf(sets, exercise.exerciseId);
        const done = own.filter((s) => s.isCompleted).length;
        return { exercise, done, total: own.length, complete: own.length > 0 && done === own.length };
      }),
    [exercises, sets],
  );
}
