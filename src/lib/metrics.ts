/**
 * Тренувальні метрики. Усі ваги — в кг (як у базі).
 * Використовуються на дашборді та в алгоритмі прогресії (src/lib/progression.ts).
 *
 * Усі функції чисті: не залежать від React, Supabase чи поточної дати,
 * тому однаково працюють на сервері, на клієнті й у тестах.
 */

/** Мінімальна форма підходу, потрібна для підрахунку тоннажу. */
export interface VolumeSet {
  weight: number;
  reps: number;
  isCompleted: boolean;
}

/**
 * Прибирає «хвости» двійкової арифметики з плаваючою комою
 * (наприклад, 62.49999999999999 → 62.5). Шість знаків після коми з
 * запасом достатньо для будь-якої ваги в кг.
 */
export function cleanFloat(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  const result = Math.round(value * factor) / factor;
  // Нормалізуємо −0 до 0, щоб не з'являлося «-0 kg».
  return result === 0 ? 0 : result;
}

/**
 * Оцінка одноповторного максимуму (1ПМ) за формулою Еплі:
 *   1RM = weight × (1 + reps / 30).
 *
 * Особливі випадки:
 * - 0 повторень (або вага ≤ 0) → 0: підхід не виконано, оцінювати нічого;
 * - 1 повторення → сама вага: це і є фактичний 1ПМ, формула Еплі
 *   для reps = 1 дала б завищене значення (weight × 1.033).
 *
 * Обчислюємо як weight × (30 + reps) / 30 — так менше похибок float
 * (60 × 12 дає рівно 84, а не 84.00000000000001).
 */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return (weight * (30 + reps)) / 30;
}

/** Тоннаж (об'єм) одного підходу: weight × reps. Від'ємні значення вважаємо нулем. */
export function setVolume(weight: number, reps: number): number {
  return Math.max(0, weight) * Math.max(0, reps);
}

/** Тоннаж тренування: сума тоннажів лише виконаних підходів. */
export function sessionVolume(sets: readonly VolumeSet[]): number {
  const total = sets
    .filter((s) => s.isCompleted)
    .reduce((sum, s) => sum + setVolume(s.weight, s.reps), 0);
  return cleanFloat(total);
}

/**
 * Округлення ваги до найближчого кратного кроку `increment`
 * (крок диска: 2.5 кг для жиму, 5 кг для присідань, 1 кг для гантелей).
 * Рівно посередині округлюємо вгору: 56.25 при кроці 2.5 → 57.5.
 *
 * Захист від похибок float відбувається у два етапи:
 * 1) частку weight / increment спершу «чистимо» (0.35 / 0.1 = 3.4999999999999996 → 3.5),
 *    інакше Math.round округлив би не в той бік;
 * 2) добуток n × increment теж «чистимо» (25 × 2.5 → 62.5, а не 62.49999…).
 *
 * Некоректний крок (≤ 0 або не скінченне число) — повертаємо вагу без змін.
 */
export function roundToIncrement(weight: number, increment: number): number {
  if (!(increment > 0) || !Number.isFinite(increment)) return weight;
  const steps = Math.round(cleanFloat(weight / increment, 9));
  return cleanFloat(steps * increment);
}
