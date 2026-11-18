import type { Suggestion } from "@/lib/progression";
import type { WeightUnit } from "@/lib/units";

/**
 * Пояснення рекомендації для UI — однакове на екрані тренування,
 * підсумку й дашборді. Будується з дії алгоритму та діапазону повторень,
 * а не з `reason` алгоритму: той звернений у минуле ("last time") і
 * містить вагу в кг. Алгоритм (progression.ts) лишається без UI-текстів.
 *
 * @param unit одиниці користувача — для текстів з вагою (зараз таких немає,
 *   параметр лишається, щоб виклики не змінювались, якщо вага з'явиться)
 */
export function formatSuggestionReason(
  suggestion: Pick<Suggestion, "action">,
  range: { repMin: number; repMax: number },
  unit: WeightUnit,
): string {
  void unit;
  switch (suggestion.action) {
    case "increase":
      return `All sets reached ${range.repMax} reps`;
    case "same":
      return `Reach ${range.repMax} reps on all sets first`;
    case "deload":
      return `Below ${range.repMin} reps two sessions in a row`;
    default:
      return "No history yet — pick a starting weight";
  }
}
