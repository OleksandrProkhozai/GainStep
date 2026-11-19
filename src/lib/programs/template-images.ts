/**
 * Картинки шаблонів програм (public/templates/*.webp, 384×384).
 * Прив'язка — за фіксованими id шаблонів із supabase/seed.sql.
 * Оригінали (2048px) лежать поза public/ — в assets/templates/.
 */

export const TEMPLATE_IMAGES: Readonly<Record<string, string>> = {
  "10000000-0000-0000-0000-000000000001": "/templates/full-body.webp",
  "10000000-0000-0000-0000-000000000002": "/templates/upper-lower.webp",
  "10000000-0000-0000-0000-000000000003": "/templates/push-pull-legs.webp",
};

/**
 * Шлях до картинки програми:
 *  - шаблон — за його id;
 *  - програма користувача — за source_template_id (копія шаблону має ту саму картинку);
 *  - інакше null → плитка з ініціалами.
 */
export function programImage(program: { id: string; sourceTemplateId?: string | null }): string | null {
  return (
    TEMPLATE_IMAGES[program.id] ??
    (program.sourceTemplateId ? TEMPLATE_IMAGES[program.sourceTemplateId] : undefined) ??
    null
  );
}
