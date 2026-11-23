/**
 * Алгоритм автоматизованого планування прогресії навантаження (подвійна прогресія)
 * та визначення особистих рекордів.
 *
 * Подвійна прогресія: для вправи задано діапазон повторень [repMin; repMax].
 * Спортсмен працює з однією вагою, поступово збільшуючи кількість повторень.
 * Коли в усіх робочих підходах досягнуто repMax — вага збільшується на крок,
 * а повторення знову «скидаються» до нижньої межі діапазону. Якщо ж двічі
 * поспіль не вдається навіть repMin — вага знижується приблизно на 10% (deload).
 *
 * Модуль складається лише з чистих функцій: без React, Supabase і поточної
 * дати. Усі ваги — в кг.
 */

import { cleanFloat, epley1RM, roundToIncrement } from "./metrics";

// ───────────────────────────── Типи ─────────────────────────────

/** Результат одного підходу. */
export interface SetResult {
  /** Вага, кг. */
  weight: number;
  /** Кількість повторень. */
  reps: number;
  /** Чи підхід позначено виконаним (невиконані в розрахунках не враховуються). */
  isCompleted: boolean;
}

/** Одне тренування з історії конкретної вправи. */
export interface Session {
  sets: SetResult[];
}

/** Вхідні параметри алгоритму прогресії. */
export interface ProgressionInput {
  /** Історія вправи, впорядкована від НАЙНОВІШОГО тренування до найстарішого. */
  history: readonly Session[];
  /** Нижня межа діапазону повторень. */
  repMin: number;
  /** Верхня межа діапазону повторень. */
  repMax: number;
  /** Цільова кількість робочих підходів. */
  targetSets: number;
  /** Крок зміни ваги, кг (наприклад, 2.5 або 5). */
  increment: number;
  /**
   * Обладнання вправи (exercises.equipment). Для тренажера й блока вага
   * фізично кратна кроку (стек плит), тож рекомендація прив'язується до
   * сітки кроку. Вільна вага — без прив'язки: 22.5 кг гантель при кроці 2
   * — реальна вага.
   */
  equipment?: string;
}

/** Тренажер або блок: стек плит, вага лише кратна кроку. */
export function isStackEquipment(equipment: string | null | undefined): boolean {
  return equipment === "machine" || equipment === "cable";
}

export type SuggestionAction = "increase" | "same" | "deload" | "none";

/** Рекомендація на наступне тренування. */
export interface Suggestion {
  action: SuggestionAction;
  /** Рекомендована вага, кг; null — якщо історії немає. */
  weight: number | null;
  /** Зміна відносно робочої ваги останнього тренування, кг (0 для 'none'; для 'same' — 0, якщо вага кратна кроку). */
  delta: number;
  /** Пояснення для користувача. */
  reason: string;
}

/** Найкращі показники вправи за історію. */
export interface PersonalBest {
  /** Максимальна вага, піднята хоча б на 1 повторення, кг. */
  maxWeight: number;
  /** Найбільший розрахунковий 1ПМ за формулою Еплі, кг. */
  bestE1RM: number;
}

/** Допуск для порівняння дробових чисел (1ПМ). */
const EPSILON = 1e-9;

// ──────────────────────── Допоміжні функції ────────────────────────

/** Лише виконані підходи тренування. */
function completedSets(session: Session | undefined): SetResult[] {
  return session ? session.sets.filter((s) => s.isCompleted) : [];
}

/**
 * Робочі підходи тренування — виконані підходи з найбільшою вагою.
 * Розминкові (легші) підходи таким чином відкидаються.
 * Повертає робочу вагу та самі підходи; для тренування без виконаних
 * підходів — null.
 */
export function workingSets(
  session: Session | undefined,
): { weight: number; sets: SetResult[] } | null {
  const done = completedSets(session);
  if (done.length === 0) return null;
  const weight = Math.max(...done.map((s) => s.weight));
  return { weight, sets: done.filter((s) => s.weight === weight) };
}

/** Чи був у тренуванні хоча б один робочий підхід із повтореннями < repMin. */
function missedRepMin(session: Session | undefined, repMin: number): boolean {
  const working = workingSets(session);
  return working !== null && working.sets.some((s) => s.reps < repMin);
}

/**
 * Допуск «вага вже на сітці кроку», кг: вага користувача в lb, переведена
 * в кг, трохи не збігається з сіткою (110 lb = 49.9 кг ≈ 50). Не більше
 * чверті кроку, щоб для дрібних кроків сусідні значення не злипались.
 */
function gridTolerance(increment: number): number {
  return Math.min(0.25, increment / 4);
}

/** Найбільше кратне кроку, що не перевищує x (з допуском). */
function gridFloor(x: number, increment: number): number {
  const tol = gridTolerance(increment);
  return cleanFloat(Math.floor(cleanFloat((x + tol) / increment, 9)) * increment);
}

/** Найменше кратне кроку, не менше за x (з допуском). */
function gridCeil(x: number, increment: number): number {
  const tol = gridTolerance(increment);
  return cleanFloat(Math.ceil(cleanFloat((x - tol) / increment, 9)) * increment);
}

/** Чи вага на сітці кроку (з допуском). */
function onGrid(x: number, increment: number): boolean {
  return Math.abs(x - roundToIncrement(x, increment)) <= gridTolerance(increment);
}

/** Форматує вагу для тексту пояснення: 62.5, 60 (без зайвих нулів). */
function formatKg(weight: number): string {
  return String(cleanFloat(weight));
}

// ──────────────────────── Алгоритм прогресії ────────────────────────

/**
 * Розраховує рекомендовану вагу на наступне тренування за правилами
 * подвійної прогресії.
 *
 * Кроки:
 * 1. Немає історії або в останньому тренуванні немає виконаних підходів → 'none'.
 * 2. Робоча вага w = максимальна вага серед виконаних підходів останнього тренування.
 * 3. Якщо робочих підходів ≥ targetSets і в кожному reps ≥ repMax → 'increase' (w + increment).
 * 4. Інакше, якщо в ДВОХ останніх тренуваннях поспіль був робочий підхід
 *    з reps < repMin → 'deload' (≈ −10%, щонайменше на один крок, не менше 0).
 * 5. Інакше → 'same' (залишаємо w).
 *
 * Для тренажера й блока (equipment) рекомендація завжди кратна кроку:
 * якщо в історії вага не на сітці (12.5 кг на блоці з кроком 5), вона не
 * тягнеться далі —
 * increase → наступне кратне вище (15), same → кратне нижче (10),
 * deload → −10% з округленням, але нижче за найближче кратне зверху.
 *
 * Перевірка 'increase' стоїть раніше за 'deload', тож має пріоритет.
 */
export function suggestNextWeight(input: ProgressionInput): Suggestion {
  const { history, repMin, repMax, targetSets, increment } = input;
  // Прив'язка до сітки кроку — лише для тренажера / блока.
  const snap = isStackEquipment(input.equipment);

  // Крок 1. Немає даних для розрахунку.
  const last = workingSets(history[0]);
  if (last === null) {
    return {
      action: "none",
      weight: null,
      delta: 0,
      reason: "No history yet — pick a starting weight",
    };
  }

  // Крок 2. Робоча вага останнього тренування.
  const w = last.weight;

  // Крок 3. Збільшення: усі цільові підходи виконано на верхній межі діапазону.
  const allAtTop =
    last.sets.length >= targetSets && last.sets.every((s) => s.reps >= repMax);
  if (allAtTop) {
    // Тренажер / блок — від кратного кроку знизу: 40 → 45, 12.5 → 15 (крок 5).
    const weight = cleanFloat((snap ? gridFloor(w, increment) : w) + increment);
    return {
      action: "increase",
      weight,
      delta: cleanFloat(weight - w),
      reason: `All sets reached ${repMax} reps last time`,
    };
  }

  // Крок 4. Розвантаження: недобір повторень два тренування поспіль.
  if (missedRepMin(history[0], repMin) && missedRepMin(history[1], repMin)) {
    // −10%, округлене до кроку диска…
    const rounded = roundToIncrement(0.9 * w, increment);
    // …але щонайменше на один крок легше (інакше для малих ваг
    // округлення повернуло б ту саму вагу) і не менше нуля. Для тренажера /
    // блока крок відраховуємо від кратного зверху — результат лишається на сітці.
    const top = snap ? gridCeil(w, increment) : w;
    const weight = cleanFloat(Math.max(0, Math.min(rounded, top - increment)));
    return {
      action: "deload",
      weight,
      delta: cleanFloat(weight - w),
      reason: `Below ${repMin} reps two sessions in a row — deload −10%`,
    };
  }

  // Крок 5. Продовжуємо працювати з тією самою вагою. Тренажер / блок і вага
  // не на сітці (12.5 при кроці 5) — кратне нижче: важчу вагу ще не опановано.
  const weight = snap && !onGrid(w, increment) ? gridFloor(w, increment) : w;
  return {
    action: "same",
    weight,
    delta: cleanFloat(weight - w),
    reason: `Keep ${formatKg(weight)} kg until all sets reach ${repMax} reps`,
  };
}

// ───────────────────────── Особисті рекорди ─────────────────────────

/** Чи може підхід претендувати на рекорд: виконаний і має хоча б 1 повторення. */
function isRecordCandidate(set: SetResult): boolean {
  return set.isCompleted && set.reps >= 1 && set.weight > 0;
}

/**
 * Найкращі показники за всі попередні тренування: максимальна вага та
 * найбільший 1ПМ (Еплі). Враховуються лише виконані підходи з reps ≥ 1.
 * Якщо таких підходів немає взагалі — null (історії немає).
 */
export function historyBest(sessions: readonly Session[]): PersonalBest | null {
  const candidates = sessions.flatMap((s) => s.sets).filter(isRecordCandidate);
  if (candidates.length === 0) return null;
  return {
    maxWeight: Math.max(...candidates.map((s) => s.weight)),
    bestE1RM: Math.max(...candidates.map((s) => epley1RM(s.weight, s.reps))),
  };
}

/**
 * Чи є підхід особистим рекордом відносно `best`:
 * вага більша за maxWeight АБО розрахунковий 1ПМ більший за bestE1RM.
 * Якщо попередньої історії немає (best = null) — це не рекорд:
 * перше тренування не повинно «засипати» користувача рекордами.
 */
export function isPR(set: SetResult, best: PersonalBest | null): boolean {
  if (best === null || !isRecordCandidate(set)) return false;
  return (
    set.weight > best.maxWeight + EPSILON ||
    epley1RM(set.weight, set.reps) > best.bestE1RM + EPSILON
  );
}

/**
 * Позначає рекорди в підходах поточного тренування.
 * Підходи перевіряються по черзі; після кожного рекорду `best` оновлюється,
 * тому наступний такий самий підхід уже не вважається рекордом.
 *
 * @param currentSets підходи поточного тренування в порядку виконання
 * @param previousSessions усі попередні тренування цієї вправи
 * @returns масив прапорців тієї ж довжини, що й currentSets
 */
export function detectPRs(
  currentSets: readonly SetResult[],
  previousSessions: readonly Session[],
): boolean[] {
  return markPRs(currentSets, historyBest(previousSessions));
}

/**
 * Те саме, що detectPRs, але з уже обчисленими найкращими показниками
 * історії. Зручно, коли `best` рахується на сервері один раз, а клієнт
 * перераховує рекорди наживо при кожній зміні підходів.
 */
export function markPRs(
  currentSets: readonly SetResult[],
  historyBestValue: PersonalBest | null,
): boolean[] {
  let best = historyBestValue;
  return currentSets.map((set) => {
    if (best === null || !isPR(set, best)) return false;
    best = {
      maxWeight: Math.max(best.maxWeight, set.weight),
      bestE1RM: Math.max(best.bestE1RM, epley1RM(set.weight, set.reps)),
    };
    return true;
  });
}
