import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localizedName } from "@/lib/i18n/names";
import type { Database } from "@/types/database.types";

/**
 * Назви шаблонів програм і їхніх днів мовою інтерфейсу — і для копій.
 *
 * Копія шаблону (clone_program) і тренування (workouts.name — знімок назви
 * дня) зберігають назву як звичайний текст тією мовою, що була під час
 * клонування / старту. Щоб "Full Body A" / "Все тіло A" перемикались разом
 * з мовою, назва, яка збігається з назвою шаблону чи його дня (en або uk),
 * показується як назва шаблону мовою інтерфейсу. Перейменовані користувачем
 * програми й дні не збігаються — і показуються як є.
 */

type Named = { name: string; name_uk: string | null };

/** Збережена назва (en або uk) → рядок шаблону з обома мовами. */
export type TemplateNames = ReadonlyMap<string, Named>;

/**
 * Колишні назви днів шаблонів (до 20261119000002_better_templates.sql).
 * Копії, склоновані раніше, зберігають їх — і далі показуємо мовою інтерфейсу.
 */
export const LEGACY_TEMPLATE_NAMES: readonly Named[] = [
  { name: "Upper", name_uk: "Верх" },
  { name: "Lower", name_uk: "Низ" },
];

/** Словник з рядків шаблонів: програми й дні, ключі — обидві назви. */
export function buildTemplateNames(
  templates: readonly (Named & { program_days?: readonly Named[] | null })[],
): TemplateNames {
  const map = new Map<string, Named>();
  const add = (row: Named) => {
    const value = { name: row.name, name_uk: row.name_uk };
    map.set(row.name, value);
    if (row.name_uk) map.set(row.name_uk, value);
  };
  for (const t of templates) {
    add(t);
    for (const d of t.program_days ?? []) add(d);
  }
  return map;
}

/** Назва мовою інтерфейсу, якщо це стандартна назва шаблону/дня; інакше — як є. */
export function templateName(stored: string, names: TemplateNames, locale: string): string {
  const row = names.get(stored);
  return row ? localizedName(row, locale) : stored;
}

/** Шаблони (3 програми, ~7 днів) — один запит на рендер (React cache). */
export const getTemplateNames = cache(async (supabase: SupabaseClient<Database>): Promise<TemplateNames> => {
  const { data, error } = await supabase
    .from("programs")
    .select("name, name_uk, program_days ( name, name_uk )")
    .is("owner_id", null);
  if (error) {
    console.error("template names", error);
    return new Map();
  }
  return buildTemplateNames([...data, ...LEGACY_TEMPLATE_NAMES]);
});
