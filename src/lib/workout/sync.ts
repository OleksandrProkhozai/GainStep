import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { planFromExercises, type PlanItem } from "./plan";
import { PLAN_KEY, type WorkoutStore } from "./store";

type Client = SupabaseClient<Database>;

/** Збереження складу тренування (server action saveExercisePlan). Помилка — throw. */
export type SavePlan = (workoutId: string, plan: PlanItem[]) => Promise<void>;

/** Дані для створення рядка workouts тренування, почато без мережі. */
export interface CreateWorkoutInput {
  id: string;
  programDayId: string | null;
  name: string;
  startedAt: string;
}

/** Створення рядка workouts (server action createWorkout, ідемпотентно за id). Помилка — throw. */
export type CreateWorkoutRow = (input: CreateWorkoutInput) => Promise<void>;

/**
 * Синхронізація підходів з workout_sets.
 *
 * Одиниця синхронізації — вправа: для неї upsert-иться кожен підхід, що
 * має рядок у базі (виконаний або колись виконаний), а рядки з іншими
 * номерами (після видалення підходу) видаляються. Так база завжди
 * дорівнює локальному стану вправи, і повторна відправка безпечна.
 *
 * Склад тренування (PLAN_KEY у черзі) — так само: повторна відправка
 * безпечна, бо зберігається весь масив workouts.exercise_plan.
 *
 * Тренування, почате без мережі (store.created = false), спершу створюється
 * в workouts (той самий id — повтор безпечний), і лише потім ідуть підходи.
 *
 * Невдалі вправи лишаються в черзі (store.pending) і відправляються знову
 * при наступній зміні, події 'online' або періодичній повторній спробі.
 */
export function createSyncer(
  store: WorkoutStore,
  supabase: Client,
  savePlan: SavePlan,
  createRow: CreateWorkoutRow,
) {
  let running: Promise<boolean> | null = null;
  let again = false;

  async function syncExercise(exerciseId: string) {
    const { workoutId, exercises, sets } = store.getState();
    const position = exercises.findIndex((e) => e.exerciseId === exerciseId);
    const rows = sets
      .filter((s) => s.exerciseId === exerciseId && s.tracked && s.weightKg !== null)
      .map((s) => ({
        workout_id: workoutId,
        exercise_id: exerciseId,
        exercise_position: Math.max(0, position),
        set_number: s.setNumber,
        weight: s.weightKg!,
        reps: s.reps,
        is_completed: s.isCompleted,
        completed_at: s.isCompleted ? s.completedAt : null,
      }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("workout_sets")
        .upsert(rows, { onConflict: "workout_id,exercise_id,set_number" });
      if (error) throw error;
    }

    let cleanup = supabase
      .from("workout_sets")
      .delete()
      .eq("workout_id", workoutId)
      .eq("exercise_id", exerciseId);
    if (rows.length > 0) {
      cleanup = cleanup.not("set_number", "in", `(${rows.map((r) => r.set_number).join(",")})`);
    }
    const { error } = await cleanup;
    if (error) throw error;
  }

  async function run(): Promise<boolean> {
    do {
      again = false;
      const snapshot = { ...store.getState().pending };
      const ids = Object.keys(snapshot);
      if (ids.length === 0 && store.getState().created) break;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        store.getState().setSyncStatus("offline");
        return false;
      }

      store.getState().setSyncStatus("saving");
      try {
        if (!store.getState().created) {
          const { workoutId, programDayId, meta } = store.getState();
          await createRow({ id: workoutId, programDayId, name: meta.name, startedAt: meta.startedAt });
          store.getState().markCreated();
        }
        for (const id of ids) {
          if (id === PLAN_KEY) {
            const { workoutId, exercises } = store.getState();
            await savePlan(workoutId, planFromExercises(exercises));
          } else {
            await syncExercise(id);
          }
          store.getState().ackSynced({ [id]: snapshot[id] });
        }
      } catch (error) {
        console.error("workout sync failed", error);
        store.getState().setSyncStatus("offline");
        return false;
      }
    } while (again || Object.keys(store.getState().pending).length > 0 || !store.getState().created);

    store.getState().setSyncStatus("saved");
    return true;
  }

  /** Відправляє чергу. true — якщо черга порожня після відправки. */
  function flush(): Promise<boolean> {
    if (running) {
      again = true;
      return running;
    }
    running = run().finally(() => {
      running = null;
    });
    return running;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Відкладена відправка: швидкі натискання степера зливаються в один запит. */
  function schedule(delay = 600) {
    clearTimeout(timer);
    if (Object.keys(store.getState().pending).length > 0 || !store.getState().created) {
      store.getState().setSyncStatus(navigator.onLine ? "saving" : "offline");
    }
    timer = setTimeout(() => void flush(), delay);
  }

  return { flush, schedule, cancel: () => clearTimeout(timer) };
}
