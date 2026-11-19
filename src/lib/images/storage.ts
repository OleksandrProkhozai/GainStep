/**
 * Фото користувача в Supabase Storage (вправи, програми): формат шляху,
 * перевірка власника, public URL, параметри стискання.
 * Шлях об'єкта — "<user id>/<uuid>.webp" (або .jpg) у bucket відповідної
 * сутності; RLS дозволяє писати лише у свою папку. Чисті функції.
 */

/** Що приймаємо від користувача і до чого стискаємо (512×512). */
export const IMAGE_UPLOAD = {
  /** Типи файлів, які можна вибрати. */
  accept: ["image/jpeg", "image/png", "image/webp"] as readonly string[],
  /** Максимальний розмір вихідного файлу (до стискання), байт. */
  maxInputBytes: 10 * 1024 * 1024,
  /** Сторона квадрата після обрізання, px. */
  size: 512,
  /** Якість webp / jpeg. */
  quality: 0.85,
} as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** "<user id>/<uuid>.webp" (або .jpg — браузери без кодування webp у canvas). */
export const IMAGE_PATH_RE = new RegExp(`^${UUID}/${UUID}\\.(webp|jpg)$`, "i");

/** Шлях належить користувачу (його папка в bucket) і має правильний формат. */
export function isOwnImagePath(path: string, userId: string): boolean {
  return IMAGE_PATH_RE.test(path) && path.toLowerCase().startsWith(`${userId.toLowerCase()}/`);
}

/** Новий шлях для завантаження у папку користувача. */
export function newImagePath(userId: string, id: string, ext: "webp" | "jpg" = "webp"): string {
  return `${userId}/${id}.${ext}`;
}

/** Public URL об'єкта з bucket; без шляху — null. */
export function storagePublicUrl(
  bucket: string,
  path: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!path || !supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}
