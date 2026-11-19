/**
 * Ініціали програми для плитки: перші літери слів (максимум 3), без символів.
 * "Full Body" → "FB", "Upper / Lower" → "UL", "Push Pull Legs" → "PPL".
 * Одне слово — дві перші літери ("Strength" → "ST"); порожньо — "?".
 */
export function programInitials(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toLocaleUpperCase();
}
