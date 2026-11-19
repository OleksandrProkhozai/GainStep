import type { Suggestion } from "@/lib/progression";

/**
 * Пояснення рекомендації для UI — однакове на екрані тренування,
 * підсумку й дашборді. Будується з дії алгоритму та діапазону повторень,
 * а не з `reason` алгоритму: той звернений у минуле ("last time") і
 * містить вагу в кг. Алгоритм (progression.ts) лишається без UI-текстів.
 *
 * Повертає ключ повідомлення (common.suggestion.reason.*) і значення —
 * текст складає компонент мовою інтерфейсу:
 *   t(`suggestion.reason.${key}`, values)
 */
export function suggestionReason(
  suggestion: Pick<Suggestion, "action">,
  range: { repMin: number; repMax: number },
): { key: Suggestion["action"]; values: { repMin: number; repMax: number } } {
  return { key: suggestion.action, values: { repMin: range.repMin, repMax: range.repMax } };
}
