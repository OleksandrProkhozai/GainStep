"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { WeightUnit } from "@/lib/units";
import type { WorkoutActions, WorkoutState, WorkoutStore } from "@/lib/workout/store";

export const WorkoutStoreContext = createContext<WorkoutStore | null>(null);

export function useWorkoutStoreApi() {
  const store = useContext(WorkoutStoreContext);
  if (!store) throw new Error("useWorkout must be used inside <WorkoutScreen>");
  return store;
}

/**
 * Читання стору тренування. Селектор має повертати стабільні значення
 * (поля стану, а не нові масиви) — похідні дані рахуйте через useMemo.
 */
export function useWorkout<T>(selector: (state: WorkoutState & WorkoutActions) => T): T {
  return useStore(useWorkoutStoreApi(), selector);
}

/** Дії екрана, яким потрібні мережа, таймери чи діалоги. */
export interface ScreenApi {
  workoutId: string;
  name: string;
  programName: string | null;
  startedAt: number;
  unit: WeightUnit;
  /** Позначити підхід виконаним + відпочинок + розгорнути наступний. */
  completeSet: (clientId: string) => void;
  requestFinish: () => void;
  requestDiscard: () => void;
  openAddExercise: () => void;
  openNote: () => void;
  openExercises: () => void;
  finishing: boolean;
}

export const ScreenContext = createContext<ScreenApi | null>(null);

export function useScreen() {
  const api = useContext(ScreenContext);
  if (!api) throw new Error("useScreen must be used inside <WorkoutScreen>");
  return api;
}
