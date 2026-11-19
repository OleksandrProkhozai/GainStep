/**
 * Назви системних даних мовою інтерфейсу. Українська назва є лише в
 * системних вправах і шаблонах (name_uk); власні дані користувача
 * не перекладаються — для них nameUk порожнє і показується name.
 */

/** Вправа: (locale === 'uk' && nameUk) ? nameUk : name. */
export function exerciseName(exercise: { name: string; nameUk?: string | null }, locale: string) {
  return locale === "uk" && exercise.nameUk ? exercise.nameUk : exercise.name;
}

/** Те саме для рядків бази (programs, program_days, exercises) з полем name_uk. */
export function localizedName(row: { name: string; name_uk?: string | null }, locale: string) {
  return locale === "uk" && row.name_uk ? row.name_uk : row.name;
}

/** Пошук по обох назвах (бібліотека, picker): "жим" знайде "Bench Press". */
export function matchesExerciseQuery(exercise: { name: string; nameUk?: string | null }, query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return (
    exercise.name.toLocaleLowerCase().includes(q) ||
    (exercise.nameUk?.toLocaleLowerCase().includes(q) ?? false)
  );
}
