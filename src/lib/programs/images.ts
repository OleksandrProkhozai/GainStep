/**
 * Картинки програм.
 *  - Власне фото — об'єкт у bucket program-images: "<user id>/<uuid>.webp" (.jpg)
 *    (programs.image_path), показується за public URL.
 *  - Шаблон і копія шаблону — картинка шаблону (template-images.ts).
 *  - Власна програма без фото — CUSTOM_PROGRAM_IMAGE.
 *  - Інакше (невідомий шаблон) — null: плитка з ініціалами.
 * Чисті функції, без React і Supabase-клієнта.
 */

import { storagePublicUrl } from "@/lib/images/storage";
import { programImage } from "./template-images";

export const PROGRAM_IMAGES_BUCKET = "program-images";

/** Картинка власної програми за замовчуванням (оригінал — assets/programs/). */
export const CUSTOM_PROGRAM_IMAGE = "/programs/custom-default.webp";

/** Public URL фото програми; без шляху — null. */
export function programImageUrl(path: string | null | undefined, supabaseUrl?: string): string | null {
  return storagePublicUrl(PROGRAM_IMAGES_BUCKET, path, supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Що показувати в мініатюрі програми; null — плитка з ініціалами. */
export function programThumbSrc(
  program: { id: string; sourceTemplateId?: string | null; imagePath?: string | null; custom?: boolean },
  supabaseUrl?: string,
): string | null {
  return (
    programImageUrl(program.imagePath, supabaseUrl) ??
    programImage(program) ??
    (program.custom ? CUSTOM_PROGRAM_IMAGE : null)
  );
}
