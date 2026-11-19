/**
 * Картинки вправ.
 *  - Власне фото — об'єкт у bucket exercise-images: "<user id>/<uuid>.webp" (.jpg)
 *    (exercises.image_path), показується за public URL.
 *  - Власна вправа без фото — CUSTOM_EXERCISE_IMAGE.
 *  - Системна вправа — картинка групи м'язів (public/muscles).
 * Чисті функції, без React і Supabase-клієнта.
 */

import { IMAGE_UPLOAD, storagePublicUrl } from "@/lib/images/storage";
import { muscleImage } from "./muscles";

export { IMAGE_PATH_RE, isOwnImagePath, newImagePath } from "@/lib/images/storage";

export const EXERCISE_IMAGES_BUCKET = "exercise-images";

/** Картинка власної вправи за замовчуванням (оригінал — assets/exercises/). */
export const CUSTOM_EXERCISE_IMAGE = "/exercises/custom-default.webp";

/** Параметри завантаження (спільні для вправ і програм). */
export const EXERCISE_IMAGE_UPLOAD = IMAGE_UPLOAD;

/** Public URL фото вправи; без шляху — null. */
export function exerciseImageUrl(path: string | null | undefined, supabaseUrl?: string): string | null {
  return storagePublicUrl(EXERCISE_IMAGES_BUCKET, path, supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/**
 * Що показувати в мініатюрі: власне фото → для власної вправи картинка
 * за замовчуванням → картинка групи м'язів.
 */
export function exerciseThumbSrc(
  exercise: { muscleGroup: string; imagePath?: string | null; custom?: boolean },
  supabaseUrl?: string,
): string {
  return (
    exerciseImageUrl(exercise.imagePath, supabaseUrl) ??
    (exercise.custom ? CUSTOM_EXERCISE_IMAGE : muscleImage(exercise.muscleGroup))
  );
}
