/// <reference lib="webworker" />
/**
 * Service worker GainStep (Serwist). Збирається лише в production:
 * `npm run build` → scripts/build-sw.mjs → public/sw.js (з маніфестом
 * precache). У development SW не реєструється.
 *
 *  - precache: _next/static (JS, CSS, шрифти next/font), іконки,
 *    /muscles, /templates, /programs;
 *  - сторінки (navigation) — NetworkFirst, таймаут 3 с, далі кеш, далі /offline;
 *  - зображення — CacheFirst;
 *  - GET до Supabase REST — NetworkFirst з кешем;
 *  - POST (Server Actions, запис у Supabase) не кешуються — SW їх не чіпає.
 */
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
  type SerwistPlugin,
} from "serwist";
import { CACHE_NAMES, OFFLINE_URL } from "../lib/pwa/cache-names";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Підставляє @serwist/build (injectManifest) під час збирання. */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

/** Сторінки, які не кешуємо: вхід через OAuth, API, експорт. */
const NO_CACHE_PAGES = /^\/(?:auth|api)\//;

/** Офлайн-фолбек для сторінок: немає ні мережі, ні копії в кеші. */
const offlineFallback: SerwistPlugin = {
  handlerDidError: async () =>
    (await caches.match(OFFLINE_URL, { cacheName: CACHE_NAMES.offline })) ?? Response.error(),
};

const runtimeCaching: RuntimeCaching[] = [
  // Сторінки застосунку. Cookie сесії йде з запитом, тож у кеші — сторінки
  // цього користувача (кеш чиститься на сторінці входу).
  {
    matcher: ({ request, url, sameOrigin }) =>
      sameOrigin && request.mode === "navigate" && !NO_CACHE_PAGES.test(url.pathname),
    handler: new NetworkFirst({
      cacheName: CACHE_NAMES.pages,
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * DAY }),
        offlineFallback,
      ],
    }),
  },
  // Запити RSC (клієнтська навігація Next) свідомо не кешуємо: без мережі
  // Next сам переходить на звичайну (документну) навігацію, і спрацьовує
  // правило сторінок вище.
  //
  // Статика Next поза precache (чанки попередньої збірки) — CacheFirst.
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: CACHE_NAMES.static,
      plugins: [new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 30 * DAY })],
    }),
  },
  // Зображення: свої, /_next/image і фото вправ / програм зі Storage Supabase.
  {
    matcher: ({ request }) => request.destination === "image",
    handler: new CacheFirst({
      cacheName: CACHE_NAMES.images,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * DAY, purgeOnQuotaError: true }),
      ],
    }),
  },
  {
    matcher: ({ request }) => request.destination === "font",
    handler: new CacheFirst({
      cacheName: CACHE_NAMES.static,
      plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 365 * DAY })],
    }),
  },
  // Supabase REST, лише GET (читання даних тренування з браузера: історія
  // вправ, бібліотека). Запис (POST / PATCH / DELETE) іде повз SW.
  {
    method: "GET",
    matcher: ({ url, sameOrigin }) => !sameOrigin && url.pathname.startsWith("/rest/v1/"),
    handler: new NetworkFirst({
      cacheName: CACHE_NAMES.supabase,
      networkTimeoutSeconds: 5,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 14 * DAY, purgeOnQuotaError: true }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching,
});

/** Кладе /offline у кеш (при встановленні й на прохання сторінки — мова, нова збірка). */
async function cacheOfflinePage() {
  const response = await fetch(OFFLINE_URL, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok || response.redirected) return;
  const cache = await caches.open(CACHE_NAMES.offline);
  await cache.put(OFFLINE_URL, response);
}

self.addEventListener("install", (event) => {
  // Невдача (немає мережі) не зриває встановлення — сторінку покладемо пізніше.
  event.waitUntil(cacheOfflinePage().catch(() => undefined));
});

self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "CACHE_OFFLINE_PAGE") {
    event.waitUntil(cacheOfflinePage().catch(() => undefined));
  }
});

serwist.addEventListeners();
