/**
 * Шаблони програм: фіксовані id (supabase/seed.sql і міграція
 * 20261119000002_better_templates.sql), рекомендація за досвідом
 * і підпис розкладу на картці ("3× на тиждень · 2 дні по черзі").
 */

export const TEMPLATE_IDS = {
  fullBody: "10000000-0000-0000-0000-000000000001",
  upperLower: "10000000-0000-0000-0000-000000000002",
  pushPullLegs: "10000000-0000-0000-0000-000000000003",
} as const;

/**
 * Рекомендований шаблон за досвідом:
 * beginner → Full Body, intermediate → Upper / Lower, advanced → Push Pull Legs.
 * Рівня advanced поки немає в enum experience_level — гілка на майбутнє.
 * Невідомий або порожній досвід → null (нічого не рекомендуємо).
 */
export function recommendTemplateId(experience: string | null | undefined): string | null {
  switch (experience) {
    case "beginner":
      return TEMPLATE_IDS.fullBody;
    case "intermediate":
      return TEMPLATE_IDS.upperLower;
    case "advanced":
      return TEMPLATE_IDS.pushPullLegs;
    default:
      return null;
  }
}

export interface TemplateSchedule {
  /** Тренувань на тиждень: "3" або діапазон "3–6". */
  perWeek: string;
  /** Скільки різних днів у програмі. */
  days: number;
  /** Днів менше, ніж тренувань на тиждень, — дні чергуються (A/B/A, B/A/B). */
  alternating: boolean;
}

/**
 * Розклад для картки шаблону з days_per_week і кількості днів:
 *  - 3× і 2 дні → "3×", 2 дні по черзі (Full Body);
 *  - 4× і 4 дні → "4×", 4 дні (Upper / Lower);
 *  - 6× і 3 дні → "3–6×", 3 дні: коло 3 тренування, двічі по колу — 6 (PPL).
 */
export function templateSchedule(daysPerWeek: number, dayCount: number): TemplateSchedule {
  const twiceThrough = dayCount > 0 && daysPerWeek >= dayCount * 2;
  return {
    perWeek: twiceThrough ? `${dayCount}–${daysPerWeek}` : String(daysPerWeek),
    days: dayCount,
    alternating: !twiceThrough && dayCount > 0 && dayCount < daysPerWeek,
  };
}
