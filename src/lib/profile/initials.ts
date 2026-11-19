/**
 * Ініціали для аватара: "Oleksandr Prokhozai" → "OP", "Oleksandr" → "O",
 * "alex.smith@x.com" → "AS". Порожнє ім'я — ініціали з email.
 */
export function getInitials(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email?.trim() || "";
  const base = source.includes("@") ? source.split("@")[0] : source;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 1) : parts[0][0] + parts[1][0];
  return letters.toLocaleUpperCase();
}
