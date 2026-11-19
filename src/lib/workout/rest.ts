/**
 * Мінімальний відпочинок з налаштувань (profiles.min_rest_seconds):
 * відпочинок будь-якої вправи не менший за нього. Застосовується лише
 * при показі й у таймері — rest_seconds у програмах не перезаписуються.
 */

/** Ефективний відпочинок, с: max(відпочинок вправи, мінімум). Мінімум ≤ 0 — вимкнено. */
export function effectiveRest(exerciseRestSeconds: number, minRestSeconds: number): number {
  return Math.max(exerciseRestSeconds, minRestSeconds);
}

/** Відпочинок вправи піднято мінімумом з налаштувань (для значка-замка). */
export function isRaisedByMin(exerciseRestSeconds: number, minRestSeconds: number): boolean {
  return minRestSeconds > exerciseRestSeconds;
}
