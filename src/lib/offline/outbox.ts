/**
 * Черга завершення тренувань без мережі — чисті функції без React,
 * Supabase і localStorage (зберігання — offline-store.ts, мережа — flush.ts).
 *
 * "Завершити" без мережі не падає: тренування потрапляє сюди, екран
 * показує локальний підсумок, а finishWorkout відправляється, щойно
 * з'явиться мережа. Ключ — id тренування: повторне "Завершити" не
 * створює дубль, а finishWorkout на сервері теж ідемпотентний.
 */

/** Тренування, що чекає відправки завершення. */
export interface FinishTask {
  workoutId: string;
  /** Назва — для банера й локального підсумку. */
  name: string;
  notes: string;
  /** Коли натиснули "Завершити", ISO (на сервер іде саме цей час). */
  finishedAt: string;
}

/** Додає завершення в чергу. Уже є з таким id — черга не змінюється (той самий масив). */
export function addFinish(queue: readonly FinishTask[], task: FinishTask): readonly FinishTask[] {
  if (queue.some((t) => t.workoutId === task.workoutId)) return queue;
  return [...queue, task];
}

/** Прибирає завершення з черги (після успішної відправки). */
export function removeFinish(queue: readonly FinishTask[], workoutId: string): readonly FinishTask[] {
  return queue.some((t) => t.workoutId === workoutId) ? queue.filter((t) => t.workoutId !== workoutId) : queue;
}

export function findFinish(queue: readonly FinishTask[], workoutId: string): FinishTask | null {
  return queue.find((t) => t.workoutId === workoutId) ?? null;
}

/**
 * Результат спроби:
 *  - done  — тренування завершено на сервері (або вже було завершене);
 *  - retry — немає мережі / тимчасова помилка, лишається в черзі;
 *    error — код, якщо відповів сервер (а не мережа);
 *  - drop  — повторювати марно (тренування немає на сервері).
 */
export type FinishAttempt =
  | { kind: "done" }
  | { kind: "retry"; error?: string }
  | { kind: "drop"; error: string };

export interface FinishDeps {
  /** Відправити підходи тренування (і створити рядок, якщо почато офлайн). true — усе відправлено. */
  syncSets: (task: FinishTask) => Promise<boolean>;
  /** finishWorkout; мережева помилка — throw. */
  complete: (task: FinishTask) => Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Помилки, після яких повтор нічого не змінить. */
const PERMANENT_ERRORS = new Set(["workoutNotFound"]);

/** Одна спроба відправити завершення: спершу підходи, потім finishWorkout. */
export async function sendFinish(task: FinishTask, deps: FinishDeps): Promise<FinishAttempt> {
  try {
    if (!(await deps.syncSets(task))) return { kind: "retry" };
    const result = await deps.complete(task);
    if (result.ok) return { kind: "done" };
    return PERMANENT_ERRORS.has(result.error)
      ? { kind: "drop", error: result.error }
      : { kind: "retry", error: result.error };
  } catch {
    return { kind: "retry" };
  }
}

/**
 * Відправляє всю чергу по черзі (по одному тренуванню — порядок
 * завершення зберігається в історії). Повертає результат для кожного id;
 * чергу змінює викликач (removeFinish для done / drop), бо за час
 * відправки в неї могли додати нове.
 */
export async function processFinishQueue(
  queue: readonly FinishTask[],
  deps: FinishDeps,
): Promise<{ workoutId: string; attempt: FinishAttempt }[]> {
  const results: { workoutId: string; attempt: FinishAttempt }[] = [];
  for (const task of queue) {
    results.push({ workoutId: task.workoutId, attempt: await sendFinish(task, deps) });
  }
  return results;
}

/** Черга після відправки: прибрати done і drop, решту лишити. */
export function applyFinishResults(
  queue: readonly FinishTask[],
  results: readonly { workoutId: string; attempt: FinishAttempt }[],
): readonly FinishTask[] {
  return results.reduce(
    (q, r) => (r.attempt.kind === "retry" ? q : removeFinish(q, r.workoutId)),
    queue,
  );
}
