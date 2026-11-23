/**
 * Назви кешів service worker'а (src/app/sw.ts). Спільні з клієнтом:
 * при виході з акаунта кеші з даними користувача видаляються.
 */
export const CACHE_NAMES = {
  /** HTML сторінок (NetworkFirst). */
  pages: "gs-pages",
  /** Офлайн-фолбек /offline. */
  offline: "gs-offline",
  /** GET-запити до Supabase REST (NetworkFirst). */
  supabase: "gs-supabase-rest",
  /** Зображення (CacheFirst). */
  images: "gs-images",
  /** Шрифти та статика поза precache (CacheFirst). */
  static: "gs-static",
} as const;

/** Кеші з даними конкретного користувача. */
export const USER_CACHES = [CACHE_NAMES.pages, CACHE_NAMES.supabase] as const;

export const OFFLINE_URL = "/offline";
