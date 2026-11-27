/**
 * "Чому така вага?" — пояснення рекомендації алгоритму подвійної прогресії
 * (suggestNextWeight) людською мовою:
 *
 *   Минулого разу (19 лист.): 60 кг × 12, 12, 12. Ціль 3 × 8–12 — усі
 *   підходи на верхній межі → +2,5 кг.
 *
 * Чиста функція: вхід — той самий ProgressionInput, що отримав алгоритм,
 * і його результат. Тексти en / uk — тут же (як і алгоритм, модуль не
 * залежить від React / next-intl і тестується напряму). Класифікація
 * недобору (невдале тренування, сильний недобір) — функції progression.ts,
 * без дублювання правила.
 */

import {
  isFailedSession,
  isPureBodyweight,
  shortfallSets,
  withCompletedSets,
  workingSets,
  type ProgressionInput,
  type Suggestion,
} from "./progression";
import { dateFormat } from "./dates";
import { formatNumber, formatWeight, toDisplayWeight, unitLabel, type WeightUnit } from "./units";

export interface ExplainInput extends ProgressionInput {
  /** Одиниці показу ваги; за замовчуванням kg. */
  unit?: WeightUnit;
}

type Lang = "en" | "uk";

/** Значення, з яких складаються речення. */
interface Parts {
  /** "60 кг × 12, 12, 12" */
  last: string;
  date: string | null;
  /** "3 × 8–12" */
  target: string;
  repMin: number;
  repMax: number;
  /** Рекомендована вага: "62,5 кг" */
  weight: string;
  /** Зміна в одиницях користувача: "+2,5 кг" / "−5 кг" */
  delta: string;
  done: number;
  targetSets: number;
  /** Кількість підходів із сильним недобором (reps ≤ repMin − 2). */
  failCount: number;
  /** Повторення в цих підходах: "6" або "5–6". */
  failReps: string;
  /** Найбільший недобір до repMin серед робочих підходів (для "недобір 1 повторення"). */
  shortBy: number;
}

/** uk: 1 підхід, 2 підходи, 5 підходів. */
function ukSets(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return "підхід";
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "підходи";
  return "підходів";
}

/** uk: 1 повторення, 5 повторень. */
function ukReps(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  return (d >= 1 && d <= 4 && (dd < 11 || dd > 14)) ? "повторення" : "повторень";
}

const TEXT: Record<Lang, {
  none: string;
  bodyweight: (p: Pick<Parts, "repMax">) => string;
  last: (p: Parts) => string;
  increase: (p: Parts) => string;
  deload: (p: Parts) => string;
  failedOnce: (p: Parts) => string;
  singleShortfall: (p: Parts) => string;
  shortByFew: (p: Parts) => string;
  fewerSets: (p: Parts) => string;
  same: (p: Parts) => string;
  snapped: (p: Parts) => string;
}> = {
  uk: {
    none: "Ще немає історії — оберіть стартову вагу.",
    bodyweight: (p) => `Вправа з власною вагою: вагу не додаємо — збільшуйте повторення до ${p.repMax} у всіх підходах.`,
    last: (p) => (p.date ? `Минулого разу (${p.date}): ${p.last}.` : `Минулого разу: ${p.last}.`),
    increase: (p) => `Ціль ${p.target} — усі підходи на верхній межі → ${p.delta}.`,
    deload: (p) => `Другий раз поспіль сильний недобір → розвантаження −10% → ${p.weight}.`,
    failedOnce: (p) =>
      `${p.failCount} ${ukSets(p.failCount)} по ${p.failReps} при мінімумі ${p.repMin} → та сама вага, ${p.weight}. Якщо повториться наступного разу, буде розвантаження.`,
    singleShortfall: (p) =>
      `Сильний недобір лише в ${p.failCount === 1 ? "одному підході" : `${p.failCount} підходах`} (${p.failReps} при мінімумі ${p.repMin}) → та сама вага, ${p.weight}.`,
    shortByFew: (p) =>
      `Недобір ${p.shortBy} ${ukReps(p.shortBy)} до мінімуму ${p.repMin} — тримаємо вагу, ${p.weight}, наступного разу спробуйте добрати.`,
    fewerSets: (p) => `Ціль ${p.target} — виконано ${p.done} з ${p.targetSets} підходів → та сама вага, ${p.weight}.`,
    same: (p) => `Ціль ${p.target} — ще не всі підходи на ${p.repMax} повторень → та сама вага, ${p.weight}.`,
    snapped: (p) => `Ціль ${p.target} — ще не всі підходи на ${p.repMax} повторень → ${p.weight} (кратно кроку тренажера).`,
  },
  en: {
    none: "No history yet — pick a starting weight.",
    bodyweight: (p) => `Bodyweight exercise: no weight is added — build up to ${p.repMax} reps on all sets.`,
    last: (p) => (p.date ? `Last time (${p.date}): ${p.last}.` : `Last time: ${p.last}.`),
    increase: (p) => `Target ${p.target} — all sets at the top of the range → ${p.delta}.`,
    deload: (p) => `Big rep shortfall for the second session in a row → deload −10% → ${p.weight}.`,
    failedOnce: (p) =>
      `${p.failCount} ${p.failCount === 1 ? "set" : "sets"} of ${p.failReps} with a minimum of ${p.repMin} → same weight, ${p.weight}. If it happens again next time, it's a deload.`,
    singleShortfall: (p) =>
      `Big shortfall on only ${p.failCount === 1 ? "one set" : `${p.failCount} sets`} (${p.failReps} with a minimum of ${p.repMin}) → same weight, ${p.weight}.`,
    shortByFew: (p) =>
      `${p.shortBy} ${p.shortBy === 1 ? "rep" : "reps"} short of the minimum ${p.repMin} — keeping ${p.weight}, try to make it up next time.`,
    fewerSets: (p) => `Target ${p.target} — ${p.done} of ${p.targetSets} sets done → same weight, ${p.weight}.`,
    same: (p) => `Target ${p.target} — not all sets at ${p.repMax} reps yet → same weight, ${p.weight}.`,
    snapped: (p) => `Target ${p.target} — not all sets at ${p.repMax} reps yet → ${p.weight} (machine step).`,
  },
};

const lang = (locale: string): Lang => (locale.startsWith("uk") ? "uk" : "en");

/** "19 лист." / "19 Nov" — дата тренування в поясі й мові застосунку (як і решта дат). */
function shortDate(iso: string | undefined, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormat(lang(locale), { day: "numeric", month: "short" }).format(date);
}

/** "6" або "5–6" — повторення в підходах із сильним недобором. */
function repsSpan(reps: readonly number[]): string {
  if (reps.length === 0) return "";
  const lo = Math.min(...reps);
  const hi = Math.max(...reps);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/**
 * Пояснення рекомендації: що було минулого разу, яка ціль і чому саме така
 * вага. `input` — той самий вхід, що отримав suggestNextWeight, `suggestion`
 * — його результат.
 */
export function explainSuggestion(input: ExplainInput, suggestion: Suggestion, locale: string): string {
  const l = lang(locale);
  const text = TEXT[l];
  const unit = input.unit ?? "kg";
  const history = withCompletedSets(input.history);
  const last = workingSets(history[0]);

  // Власна вага — і без історії: "оберіть стартову вагу" тут не пасує.
  if (isPureBodyweight(input.equipment, history)) return text.bodyweight({ repMax: input.repMax });
  if (suggestion.action === "none" || suggestion.weight === null || last === null) return text.none;

  const fmt = (kg: number) => formatWeight(kg, unit, l);
  const deltaValue = toDisplayWeight(suggestion.weight, unit) - toDisplayWeight(last.weight, unit);
  const shortfall = shortfallSets(history[0], input.repMin);
  const parts: Parts = {
    last: `${fmt(last.weight)} × ${last.sets.map((s) => s.reps).join(", ")}`,
    date: shortDate(history[0].startedAt, locale),
    target: `${input.targetSets} × ${input.repMin === input.repMax ? input.repMax : `${input.repMin}–${input.repMax}`}`,
    repMin: input.repMin,
    repMax: input.repMax,
    weight: fmt(suggestion.weight),
    delta: `${deltaValue >= 0 ? "+" : "−"}${formatNumber(Math.abs(deltaValue), l)} ${unitLabel(unit, l)}`,
    done: last.sets.length,
    targetSets: input.targetSets,
    failCount: shortfall.length,
    failReps: repsSpan(shortfall.map((s) => s.reps)),
    shortBy: Math.max(0, input.repMin - Math.min(...last.sets.map((s) => s.reps))),
  };

  let reason: string;
  switch (suggestion.action) {
    case "increase":
      reason = text.increase(parts);
      break;
    case "deload":
      reason = text.deload(parts);
      break;
    default:
      // Попередження про розвантаження — лише після невдалого тренування.
      if (isFailedSession(history[0], input.repMin, input.targetSets)) reason = text.failedOnce(parts);
      else if (shortfall.length > 0) reason = text.singleShortfall(parts);
      else if (parts.shortBy > 0) reason = text.shortByFew(parts);
      else if (last.sets.length < input.targetSets && last.sets.every((s) => s.reps >= input.repMax))
        reason = text.fewerSets(parts);
      else if (Math.abs(suggestion.weight - last.weight) > 1e-9) reason = text.snapped(parts);
      else reason = text.same(parts);
  }
  return `${text.last(parts)} ${reason}`;
}
