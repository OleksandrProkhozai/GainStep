import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  appendSet,
  applyWeight,
  buildSets,
  clampReps,
  clampWeightKg,
  firstPending,
  initialSets,
  removeSet,
  type RestKind,
} from "./derive";
import {
  indexAfterRemoval,
  indexAfterRestore,
  insertExercises,
  removeExercise as removeFromList,
  restoreExercise as restoreToList,
  type AddPlacement,
} from "./plan";
import type { WorkoutExercise, WorkoutInit, WorkoutSet } from "./types";
import type { WeightUnit } from "@/lib/units";

/**
 * Ключ складу тренування (workouts.exercise_plan) у черзі синхронізації.
 * Інші ключі — uuid вправ, тож збігу не буває.
 */
export const PLAN_KEY = "__plan__";

/** Прибрана вправа — для "Повернути" в toast. */
export interface RemovedExercise {
  exercise: WorkoutExercise;
  sets: WorkoutSet[];
  index: number;
}

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
  /** "set" — між підходами, "transition" — між вправами. Старі стани без поля — "set". */
  kind?: RestKind;
  /** Наступна вправа для підпису "Далі: …" (лише transition). */
  nextExerciseId?: string | null;
}

export type SyncStatus = "saved" | "saving" | "offline";

/** Шапка тренування — щоб екран будувався зі стору без мережі. */
export interface WorkoutMeta {
  name: string;
  programName: string | null;
  startedAt: string;
}

export interface WorkoutState {
  workoutId: string;
  meta: WorkoutMeta;
  /**
   * false — тренування почато без мережі: рядка в workouts ще немає,
   * його створить черга синхронізації перед першими підходами.
   * Старі збережені стани без поля — true (рядок створив сервер).
   */
  created: boolean;
  /** День програми — для створення рядка з черги. */
  programDayId: string | null;
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
  /** Додає вправи (уже наявні пропускає); повертає додані. */
  addExercises: (exercises: WorkoutExercise[], placement: AddPlacement) => WorkoutExercise[];
  /** Прибирає вправу з тренування; null — остання вправа або її немає. */
  removeExercise: (exerciseId: string) => RemovedExercise | null;
  /** Undo прибирання: вправа з підходами повертається на своє місце. */
  restoreExercise: (removed: RemovedExercise) => void;
  /** Поставити склад тренування в чергу синхронізації. */
  markPlanDirty: () => void;
  startRest: (seconds: number, now: number, kind?: RestKind, nextExerciseId?: string | null) => void;
  toggleRestPause: (now: number) => void;
  adjustRest: (seconds: number, now: number) => void;
  stopRest: () => void;
  setNotes: (notes: string) => void;
  /** Позначки синхронізації (викликає модуль sync). */
  ackSynced: (snapshot: Record<string, number>) => void;
  setSyncStatus: (status: SyncStatus) => void;
  /** Рядок у workouts створено (черга синхронізації). */
  markCreated: () => void;
}

export type WorkoutStore = ReturnType<typeof createWorkoutStore>;

const IDLE_REST: RestTimer = { endsAt: null, duration: 0, pausedRemaining: null, kind: "set", nextExerciseId: null };

export const STORAGE_PREFIX = "gainstep-workout-";

export function storageKey(workoutId: string) {
  return `${STORAGE_PREFIX}${workoutId}`;
}

/**
 * Прибирає збережені стани інших (уже завершених чи скасованих) тренувань.
 * keep — тренування, які лишаються: поточне й ті, що чекають відправки
 * завершення (їхні підходи ще не на сервері).
 */
export function purgeOtherWorkouts(keep: string | readonly string[]) {
  try {
    const keys = new Set((typeof keep === "string" ? [keep] : keep).map(storageKey));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX) && !keys.has(key)) localStorage.removeItem(key);
    }
  } catch {
    // localStorage недоступний (приватний режим) — не критично
  }
}

/** Збережений стан тренування (те, що partialize кладе в localStorage). */
export type PersistedWorkout = Pick<
  WorkoutState,
  "workoutId" | "exercises" | "sets" | "currentIndex" | "notes" | "pending"
> &
  Partial<Pick<WorkoutState, "meta" | "created" | "programDayId">>;

/**
 * Збережений стан тренування з localStorage без створення стору
 * (офлайн-екран, глобальна черга). null — немає або пошкоджений.
 */
export function readPersistedWorkout(workoutId: string): PersistedWorkout | null {
  try {
    return parsePersistedWorkout(localStorage.getItem(storageKey(workoutId)), workoutId);
  } catch {
    return null;
  }
}

/** Розбір JSON persist-middleware ({ state, version }) — чиста функція. */
export function parsePersistedWorkout(raw: string | null, workoutId: string): PersistedWorkout | null {
  if (!raw) return null;
  try {
    const state = (JSON.parse(raw) as { state?: Partial<PersistedWorkout> } | null)?.state;
    if (
      !state ||
      state.workoutId !== workoutId ||
      !Array.isArray(state.exercises) ||
      state.exercises.length === 0 ||
      !Array.isArray(state.sets)
    ) {
      return null;
    }
    return {
      meta: state.meta,
      created: state.created,
      programDayId: state.programDayId,
      workoutId,
      exercises: state.exercises,
      sets: state.sets,
      currentIndex: state.currentIndex ?? 0,
      notes: state.notes ?? "",
      pending: state.pending ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Початкові дані екрана зі збереженого стану (без сервера). Підходи й
 * решта стану підтягнуться при rehydrate, тож savedSets порожні.
 * Старі стани без meta: назва — fallbackName, старт — перший виконаний підхід.
 */
export function initFromPersisted(state: PersistedWorkout, fallbackName: string): WorkoutInit {
  const firstDone = state.sets
    .map((s) => s.completedAt)
    .filter((t): t is string => Boolean(t))
    .sort()[0];
  return {
    workoutId: state.workoutId,
    name: state.meta?.name ?? fallbackName,
    programName: state.meta?.programName ?? null,
    startedAt: state.meta?.startedAt ?? firstDone ?? new Date().toISOString(),
    notes: state.notes,
    exercises: state.exercises,
    savedSets: [],
    planStored: true,
    created: state.created ?? true,
    programDayId: state.programDayId ?? null,
  };
}

/** Прибирає збережений стан тренування (після завершення або скасування). */
export function removePersistedWorkout(workoutId: string) {
  try {
    localStorage.removeItem(storageKey(workoutId));
  } catch {
    // недоступний localStorage — нічого прибирати
  }
}

/**
 * Стор одного тренування. Ключ localStorage містить id тренування.
 * skipHydration: стан із localStorage підтягується вручну після монтування,
 * щоб серверний HTML не розходився з клієнтським.
 */
/**
 * @param unit одиниці користувача — крок підказки ваги для нових підходів
 *   (lb: 5 lb замість 2.5 кг). Без нього — кг.
 */
export function createWorkoutStore(init: WorkoutInit, unit: WeightUnit = "kg") {
  return createStore<WorkoutState & WorkoutActions>()(
    persist(
      (set, get) => {
        /** Ставить вправу в чергу, якщо в неї є рядки в базі. */
        const bump = (pending: Record<string, number>, exerciseId: string, sets: WorkoutSet[]) =>
          sets.some((s) => s.exerciseId === exerciseId && s.tracked)
            ? { ...pending, [exerciseId]: (pending[exerciseId] ?? 0) + 1 }
            : pending;

        const findSet = (clientId: string) => get().sets.find((s) => s.clientId === clientId);

        /**
         * Зміна складу: у черзі — сам склад і всі вправи з рядками в базі
         * (у них змінився exercise_position — порядок на підсумку й в історії).
         */
        const bumpPlan = (pending: Record<string, number>, sets: WorkoutSet[]) => {
          const next: Record<string, number> = { ...pending, [PLAN_KEY]: (pending[PLAN_KEY] ?? 0) + 1 };
          for (const id of new Set(sets.filter((s) => s.tracked).map((s) => s.exerciseId))) {
            next[id] = (next[id] ?? 0) + 1;
          }
          return next;
        };

        return {
          workoutId: init.workoutId,
          meta: { name: init.name, programName: init.programName, startedAt: init.startedAt },
          created: init.created ?? true,
          programDayId: init.programDayId ?? null,
          exercises: init.exercises,
          sets: buildSets(init.exercises, init.savedSets, undefined, unit),
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
            set((s) => ({ sets: appendSet(s.sets, exercise, undefined, unit) }));
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

          addExercises: (items, placement) => {
            const s = get();
            const result = insertExercises(s.exercises, items, s.currentIndex, placement);
            if (result.added.length === 0) return [];
            const sets = [...s.sets, ...result.added.flatMap((e) => initialSets(e, undefined, unit))];
            set({
              exercises: result.list,
              sets,
              currentIndex: result.currentIndex,
              pending: bumpPlan(s.pending, sets),
            });
            return result.added;
          },

          removeExercise: (exerciseId) => {
            const s = get();
            const result = removeFromList(s.exercises, exerciseId);
            if (!result) return null;
            const own = s.sets.filter((x) => x.exerciseId === exerciseId);
            const sets = s.sets.filter((x) => x.exerciseId !== exerciseId);
            // Рядки прибраної вправи видаляє синхронізація (bump — за станом ДО видалення).
            const pending = bump(bumpPlan(s.pending, sets), exerciseId, s.sets);
            // Таймер відпочинку не чіпаємо; лише "Далі: …" переводимо на іншу вправу.
            let rest = s.rest;
            if (rest.nextExerciseId === exerciseId) {
              const order = [
                ...result.list.slice(result.removedIndex),
                ...result.list.slice(0, result.removedIndex),
              ];
              const next = order.find((e) => firstPending(sets, e.exerciseId) !== null);
              rest = { ...rest, nextExerciseId: next?.exerciseId ?? null };
            }
            set({
              exercises: result.list,
              sets,
              currentIndex: indexAfterRemoval(s.currentIndex, result.removedIndex, result.list.length),
              expandedSetId: own.some((x) => x.clientId === s.expandedSetId) ? null : s.expandedSetId,
              rest,
              pending,
            });
            return { exercise: result.removed, sets: own, index: result.removedIndex };
          },

          restoreExercise: ({ exercise, sets: own, index }) => {
            const s = get();
            if (s.exercises.some((e) => e.exerciseId === exercise.exerciseId)) return;
            const exercises = restoreToList(s.exercises, exercise, index);
            const restoredIndex = exercises.findIndex((e) => e.exerciseId === exercise.exerciseId);
            const sets = [...s.sets, ...own];
            set({
              exercises,
              sets,
              currentIndex: indexAfterRestore(s.currentIndex, restoredIndex),
              pending: bump(bumpPlan(s.pending, sets), exercise.exerciseId, sets),
            });
          },

          markPlanDirty: () =>
            set((s) => ({ pending: { ...s.pending, [PLAN_KEY]: (s.pending[PLAN_KEY] ?? 0) + 1 } })),

          startRest: (seconds, now, kind = "set", nextExerciseId = null) => {
            if (seconds <= 0) return set({ rest: IDLE_REST });
            set({
              rest: {
                endsAt: now + seconds * 1000,
                duration: seconds * 1000,
                pausedRemaining: null,
                kind,
                nextExerciseId: kind === "transition" ? nextExerciseId : null,
              },
            });
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
                  ? { ...rest, endsAt: now + next, duration, pausedRemaining: null }
                  : { ...rest, endsAt: null, duration, pausedRemaining: next },
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

          markCreated: () => set({ created: true }),
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
            meta: rest.meta,
            created: rest.created,
            programDayId: rest.programDayId,
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
