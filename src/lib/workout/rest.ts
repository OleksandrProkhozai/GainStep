/**
 * Відпочинок.
 *
 * Між підходами: rest_seconds вправи, але не менше мінімального відпочинку
 * з налаштувань (profiles.min_rest_seconds). Мінімум застосовується лише
 * при показі й у таймері — rest_seconds у програмах не перезаписуються.
 *
 * Між вправами (перехідний): після останнього підходу вправи — довший
 * відпочинок, 5:00 після базової (is_compound) і 3:00 після ізолюючої,
 * або власне значення program_exercises.transition_rest_seconds.
 */

/** Ефективний відпочинок, с: max(відпочинок вправи, мінімум). Мінімум ≤ 0 — вимкнено. */
export function effectiveRest(exerciseRestSeconds: number, minRestSeconds: number): number {
  return Math.max(exerciseRestSeconds, minRestSeconds);
}

/** Відпочинок вправи піднято мінімумом з налаштувань (для значка-замка). */
export function isRaisedByMin(exerciseRestSeconds: number, minRestSeconds: number): boolean {
  return minRestSeconds > exerciseRestSeconds;
}

/** Межі й автозначення перехідного відпочинку, с. Степер у редакторі — крок 30 с, 0:00–15:00. */
export const TRANSITION_REST = { compound: 300, isolation: 180, min: 0, max: 900, step: 30 } as const;

/** Вправа, після якої рахується перехід (поля з exercises і program_exercises). */
export interface TransitionSource {
  /** exercises.is_compound; старі збережені стани без поля — ізолююча. */
  isCompound?: boolean;
  /** program_exercises.transition_rest_seconds; null / undefined — авто. */
  transitionRestSeconds?: number | null;
}

export interface RestSettings {
  /** Мінімальний відпочинок з налаштувань, с (0 — вимкнено). */
  minRestSeconds: number;
  /** Перемикач "Довший відпочинок між вправами". */
  transitionRestEnabled: boolean;
}

/** Автоматичний перехідний відпочинок: 5:00 після базової, 3:00 після ізолюючої. */
export function autoTransitionRest(exercise: TransitionSource): number {
  return exercise.isCompound ? TRANSITION_REST.compound : TRANSITION_REST.isolation;
}

/**
 * Перехідний відпочинок після вправи, с, або null — переходу немає:
 *  - вимкнено в налаштуваннях;
 *  - це остання вправа тренування (hasNextExercise = false).
 * Власне значення вправи має пріоритет над авто; результат не менший за
 * мінімальний відпочинок (effectiveRest).
 */
export function transitionRest(
  finishedExercise: TransitionSource,
  settings: RestSettings,
  hasNextExercise = true,
): number | null {
  if (!settings.transitionRestEnabled || !hasNextExercise) return null;
  const own = finishedExercise.transitionRestSeconds;
  const base = own === null || own === undefined ? autoTransitionRest(finishedExercise) : own;
  return effectiveRest(base, settings.minRestSeconds);
}

/** Крок степера "Відпочинок після вправи": ±30 с у межах 0:00–15:00. */
export function stepTransitionRest(seconds: number, direction: 1 | -1) {
  const { step, min, max } = TRANSITION_REST;
  const snapped = Math.round(seconds / step) * step;
  return Math.min(max, Math.max(min, snapped + direction * step));
}
