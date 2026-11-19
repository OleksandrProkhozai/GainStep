/**
 * Завантаження фото (вправи, програми) з браузера в Supabase Storage.
 * Фото обрізається по центру до квадрата і стискається до 512×512 webp
 * (Safari без кодування webp у canvas — jpeg), тож у bucket потрапляє
 * ~20–60 КБ замість фото з камери на кілька мегабайт.
 * Помилки — коди errors.* (текст підставляє useErrorText).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { IMAGE_UPLOAD as U, newImagePath } from "@/lib/images/storage";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

export class ImageUploadError extends Error {
  constructor(public code: "imageTypeUnsupported" | "imageTooLarge" | "imageUploadFailed") {
    super(code);
  }
}

/** Перевірка файлу до обробки. */
export function checkImageFile(file: File) {
  if (!U.accept.includes(file.type)) throw new ImageUploadError("imageTypeUnsupported");
  if (file.size > U.maxInputBytes) throw new ImageUploadError("imageTooLarge");
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Центральний квадрат → 512×512 → webp (або jpeg). */
export async function compressImage(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  let bitmap: ImageBitmap;
  try {
    // Орієнтація з EXIF (фото з телефона) — за замовчуванням "from-image".
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageUploadError("imageTypeUnsupported");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = U.size;
  canvas.height = U.size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageUploadError("imageUploadFailed");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, U.size, U.size);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", U.quality);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", U.quality);
  if (!jpeg) throw new ImageUploadError("imageUploadFailed");
  return { blob: jpeg, ext: "jpg" };
}

/** Перевірити, стиснути й завантажити у папку користувача в bucket. Повертає шлях для image_path. */
export async function uploadImage(supabase: Client, bucket: string, file: File): Promise<string> {
  checkImageFile(file);
  const { blob, ext } = await compressImage(file);

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) throw new ImageUploadError("imageUploadFailed");

  const path = newImagePath(userId, crypto.randomUUID(), ext);
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000", // шлях унікальний — файл ніколи не змінюється
    upsert: false,
  });
  if (error) {
    console.error("uploadImage", error);
    throw new ImageUploadError("imageUploadFailed");
  }
  return path;
}

/** Прибрати фото, завантажене у формі, але не збережене (скасування, заміна). Не критично. */
export async function discardImage(supabase: Client, bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error("discardImage", error);
}
