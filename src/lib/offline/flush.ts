import { createClient } from "@/lib/supabase/client";
import { finishWorkout } from "@/lib/workout/actions";
import {
  createWorkoutStore,
  initFromPersisted,
  readPersistedWorkout,
  removePersistedWorkout,
} from "@/lib/workout/store";
import { createSyncer } from "@/lib/workout/sync";
import { createWorkoutRow, savePlan } from "@/lib/workout/sync-actions";
import { offlineStore } from "./offline-store";
import { sendFinish, type FinishAttempt, type FinishDeps, type FinishTask } from "./outbox";

/** Тренування, завершення яких зараз відправляється (екран і фонова черга не дублюють). */
const inFlight = new Set<string>();

/** Відправка завершення: finishWorkout з часом і нотаткою з пристрою. */
export const completeFinish: FinishDeps["complete"] = (task) =>
  finishWorkout(task.workoutId, task.notes, task.finishedAt);

/**
 * Підходи тренування з localStorage → сервер (окремий стор, бо екран
 * тренування вже закритий). Стану немає — відправляти нічого.
 */
const syncPersisted: FinishDeps["syncSets"] = async (task) => {
  const persisted = readPersistedWorkout(task.workoutId);
  if (!persisted) return true;
  const store = createWorkoutStore(initFromPersisted(persisted, task.name));
  await store.persist.rehydrate();
  return createSyncer(store, createClient(), savePlan, createWorkoutRow).flush();
};

/** Підсумок спроби → сховище: прибрати з черги й локальний стан тренування. */
export function settleFinish(workoutId: string, attempt: FinishAttempt) {
  if (attempt.kind === "retry") return;
  removePersistedWorkout(workoutId);
  const state = offlineStore.getState();
  if (attempt.kind === "done") state.finishSent(workoutId);
  else state.dropFinish(workoutId);
  state.staleKit();
}

/** Одна спроба з блокуванням: те саме тренування не відправляється двічі паралельно. */
export async function sendFinishOnce(task: FinishTask, deps: FinishDeps): Promise<FinishAttempt | null> {
  if (inFlight.has(task.workoutId)) return null;
  inFlight.add(task.workoutId);
  try {
    const attempt = await sendFinish(task, deps);
    settleFinish(task.workoutId, attempt);
    return attempt;
  } finally {
    inFlight.delete(task.workoutId);
  }
}

let running = false;

/**
 * Фонова відправка черги завершень (подія 'online', старт застосунку,
 * періодична спроба). Повертає результати спроб (для тостів).
 */
export async function flushFinishQueue() {
  if (running || (typeof navigator !== "undefined" && !navigator.onLine)) return [];
  running = true;
  try {
    const results: { task: FinishTask; attempt: FinishAttempt }[] = [];
    for (const task of offlineStore.getState().finishes) {
      const attempt = await sendFinishOnce(task, { syncSets: syncPersisted, complete: completeFinish });
      if (attempt) results.push({ task, attempt });
      // Мережа знову пропала — решту не пробуємо.
      if (attempt?.kind === "retry" && attempt.error === undefined) break;
    }
    return results;
  } finally {
    running = false;
  }
}
