import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  appendSet,
  applyWeight,
  buildSets,
  clampReps,
  clampWeightKg,
  initialSets,
  removeSet,
} from "./derive";
import type { WorkoutExercise, WorkoutInit, WorkoutSet } from "./types";

/**
 * Стан таймера відпочинку. Рахуємо від абсолютного часу endsAt, тож
 * таймер коректний після згортання вкладки чи перезавантаження.
 *  - іде:       endsAt ≠ null
 *  - на паузі:  pausedRemaining ≠ null (мс)
 *  - вимкнений: обидва null
 */
export interface RestTimer {
  endsAt: number | null;
  /** Повна тривалість, мс (для кільця прогресу). */
  duration: number;
  pausedRemaining: number | null;
}

export type SyncStatus = "saved" | "saving" | "offline";

export interface WorkoutState {
  workoutId: string;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
  currentIndex: number;
  /** Розгорнутий підхід; null — перший невиконаний поточної вправи. */
  expandedSetId: string | null;
  rest: RestTimer;
  notes: string;
  /**
   * Черга синхронізації: exerciseId → лічильник змін. Після успішної
   * відправки вправа видаляється з черги, лише якщо за час запиту
   * лічильник не змінився (інакше нові зміни відправляться наступним колом).
   */
  pending: Record<string, number>;
  /** Не зберігається в localStorage. */
  syncStatus: SyncStatus;
}

export interface WorkoutActions {
  goTo: (index: number) => void;
  expand: (clientId: string | null) => void;
  setWeight: (clientId: string, weightKg: number) => void;
  setReps: (clientId: string, reps: number) => void;
  /** Позначає підхід виконаним; повертає вправу, щоб запустити відпочинок. */
  complete: (clientId: string, now: number) => WorkoutExercise | null;
  uncomplete: (clientId: string) => void;
  addSet: (exerciseId: string) => void;
  deleteSet: (clientId: string) => void;
  addExercise: (exercise: WorkoutExercise) => void;
  startRest: (seconds: number, now: number) => void;
  toggleRestPause: (now: number) => void;
  adjustRest: (seconds: number, now: number) => void;
  stopRest: () => void;
  setNotes: (notes: string) => void;
  /** Позначки синхронізації (викликає модуль sync). */
  ackSynced: (snapshot: Record<string, number>) => void;
  setSyncStatus: (status: SyncStatus) => void;
}

export type WorkoutStore = ReturnType<typeof createWorkoutStore>;

const IDLE_REST: RestTimer = { endsAt: null, duration: 0, pausedRemaining: null };

export const STORAGE_PREFIX = "gainstep-workout-";

export function storageKey(workoutId: string) {
  return `${STORAGE_PREFIX}${workoutId}`;
}

/** Прибирає збережені стани інших (уже завершених чи скасованих) тренувань. */
export function purgeOtherWorkouts(workoutId: string) {
  try {
    const keep = storageKey(workoutId);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX) && key !== keep) localStorage.removeItem(key);
    }
  } catch {
    // localStorage недоступний (приватний режим) — не критично
  }
}

/**
 * Стор одного тренування. Ключ localStorage містить id тренування.
 * skipHydration: стан із localStorage підтягується вручну після монтування,
 * щоб серверний HTML не розходився з клієнтським.
 */
export function createWorkoutStore(init: WorkoutInit) {
  return createStore<WorkoutState & WorkoutActions>()(
    persist(
      (set, get) => {
        /** Ставить вправу в чергу, якщо в неї є рядки в базі. */
        const bump = (pending: Record<string, number>, exerciseId: string, sets: WorkoutSet[]) =>
          sets.some((s) => s.exerciseId === exerciseId && s.tracked)
            ? { ...pending, [exerciseId]: (pending[exerciseId] ?? 0) + 1 }
            : pending;

        const findSet = (clientId: string) => get().sets.find((s) => s.clientId === clientId);

        return {
          workoutId: init.workoutId,
          exercises: init.exercises,
          sets: buildSets(init.exercises, init.savedSets),
          currentIndex: 0,
          expandedSetId: null,
          rest: IDLE_REST,
          notes: init.notes,
          pending: {},
          syncStatus: "saved",

          goTo: (index) =>
            set((s) => ({
              currentIndex: Math.min(Math.max(0, index), s.exercises.length - 1),
              expandedSetId: null,
            })),

          expand: (clientId) => set({ expandedSetId: clientId }),

          setWeight: (clientId, weightKg) => {
            const target = findSet(clientId);
            if (!target) return;
            const sets = applyWeight(get().sets, clientId, clampWeightKg(weightKg));
            set((s) => ({ sets, pending: bump(s.pending, target.exerciseId, sets) }));
          },

          setReps: (clientId, reps) => {
            const target = findSet(clientId);
            if (!target) return;
            const sets = get().sets.map((s) =>
              s.clientId === clientId ? { ...s, reps: clampReps(reps) } : s,
            );
            set((s) => ({ sets, pending: bump(s.pending, target.exerciseId, sets) }));
          },

          complete: (clientId, now) => {
            const target = findSet(clientId);
            if (!target || target.weightKg === null) return null;
            const sets = get().sets.map((s) =>
              s.clientId === clientId
                ? { ...s, isCompleted: true, completedAt: new Date(now).toISOString(), tracked: true }
                : s,
            );
            set((s) => ({
              sets,
              expandedSetId: null,
              pending: bump(s.pending, target.exerciseId, sets),
            }));
            return get().exercises.find((e) => e.exerciseId === target.exerciseId) ?? null;
          },

          uncomplete: (clientId) => {
            const target = findSet(clientId);
            if (!target) return;
            const sets = get().sets.map((s) =>
              s.clientId === clientId ? { ...s, isCompleted: false, completedAt: null } : s,
            );
            set((s) => ({ sets, pending: bump(s.pending, target.exerciseId, sets) }));
          },

          addSet: (exerciseId) => {
            const exercise = get().exercises.find((e) => e.exerciseId === exerciseId);
            if (!exercise) return;
            set((s) => ({ sets: appendSet(s.sets, exercise) }));
          },

          deleteSet: (clientId) => {
            const target = findSet(clientId);
            if (!target) return;
            const before = get().sets;
            const sets = removeSet(before, clientId);
            // У черзі, якщо рядки в базі були до видалення (номери змістилися).
            set((s) => ({
              sets,
              expandedSetId: null,
              pending: bump(s.pending, target.exerciseId, before),
            }));
          },

          addExercise: (exercise) => {
            if (get().exercises.some((e) => e.exerciseId === exercise.exerciseId)) return;
            set((s) => ({
              exercises: [...s.exercises, exercise],
              sets: [...s.sets, ...initialSets(exercise)],
              currentIndex: s.exercises.length,
              expandedSetId: null,
            }));
          },

          startRest: (seconds, now) => {
            if (seconds <= 0) return set({ rest: IDLE_REST });
            set({ rest: { endsAt: now + seconds * 1000, duration: seconds * 1000, pausedRemaining: null } });
          },

          toggleRestPause: (now) => {
            const { rest } = get();
            if (rest.endsAt !== null) {
              set({ rest: { ...rest, endsAt: null, pausedRemaining: Math.max(0, rest.endsAt - now) } });
            } else if (rest.pausedRemaining !== null) {
              set({ rest: { ...rest, endsAt: now + rest.pausedRemaining, pausedRemaining: null } });
            }
          },

          adjustRest: (seconds, now) => {
            const { rest } = get();
            const delta = seconds * 1000;
            const remaining =
              rest.endsAt !== null ? rest.endsAt - now : (rest.pausedRemaining ?? null);
            if (remaining === null) return;
            const next = Math.max(0, remaining + delta);
            if (next === 0) return set({ rest: IDLE_REST });
            const duration = Math.max(rest.duration, next);
            set({
              rest:
                rest.endsAt !== null
                  ? { endsAt: now + next, duration, pausedRemaining: null }
                  : { endsAt: null, duration, pausedRemaining: next },
            });
          },

          stopRest: () => set({ rest: IDLE_REST }),

          setNotes: (notes) => set({ notes: notes.slice(0, 2000) }),

          ackSynced: (snapshot) =>
            set((s) => {
              const pending = { ...s.pending };
              for (const [id, version] of Object.entries(snapshot)) {
                if (pending[id] === version) delete pending[id];
              }
              return { pending };
            }),

          setSyncStatus: (syncStatus) => set({ syncStatus }),
        };
      },
      {
        name: storageKey(init.workoutId),
        version: 1,
        storage: createJSONStorage(() => localStorage),
        skipHydration: true,
        // syncStatus — живий стан мережі, його не відновлюємо
        partialize: ({ syncStatus, ...rest }) => {
          void syncStatus;
          return {
            workoutId: rest.workoutId,
            exercises: rest.exercises,
            sets: rest.sets,
            currentIndex: rest.currentIndex,
            expandedSetId: rest.expandedSetId,
            rest: rest.rest,
            notes: rest.notes,
            pending: rest.pending,
          };
        },
      },
    ),
  );
}
