#!/usr/bin/env node
/**
 * Збирання service worker'а після `next build` (частина `npm run build`).
 *
 * Чому не withSerwist у next.config: плагін @serwist/next працює через
 * webpack, а Next 16 збирає Turbopack (з webpack зламалась би збірка CSS —
 * Tailwind підключено turbopack-лоадером). Тому робимо те саме, що робить
 * @serwist/cli / режим "configurator" Serwist:
 *   1) rolldown збирає src/app/sw.ts в один файл (TypeScript, без чанків);
 *   2) @serwist/build (injectManifest) підставляє маніфест precache
 *      замість self.__SW_MANIFEST і пише public/sw.js.
 * У development SW не збирається й не реєструється (sw-register.tsx).
 *
 * Запуск окремо: node scripts/build-sw.mjs (після next build — потрібна .next/static).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectManifest } from "@serwist/build";
import { build } from "rolldown";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const swSrc = path.join(root, "src/app/sw.ts");
const bundled = path.join(root, ".next/serwist/sw.js");
const swDest = path.join(root, "public/sw.js");

if (!fs.existsSync(path.join(root, ".next/static"))) {
  console.error("[build-sw] .next/static не знайдено — спершу next build");
  process.exit(1);
}

// 1) TypeScript → один IIFE-файл.
await build({
  cwd: root,
  input: swSrc,
  platform: "browser",
  logLevel: "warn",
  transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
  output: { file: bundled, format: "iife", minify: true, sourcemap: false, codeSplitting: false },
});

// 2) Маніфест precache. URL — як їх просить браузер:
//    .next/static/** → /_next/static/**, public/** → /**.
const toUrl = (file) => {
  if (file.startsWith(".next/static/")) return `/_next/static/${file.slice(".next/static/".length)}`;
  if (file.startsWith("public/")) return `/${file.slice("public/".length)}`;
  return file;
};

const { count, size, warnings } = await injectManifest({
  swSrc: bundled,
  swDest,
  globDirectory: root,
  globPatterns: [
    // JS, CSS, шрифти next/font і статичні медіа збірки
    ".next/static/**/*.{js,css,woff,woff2,ttf,png,svg,webp,jpg,jpeg,ico}",
    "public/icons/*.png",
    "public/muscles/*.{webp,png,jpg}",
    "public/templates/*.{webp,png,jpg}",
    "public/programs/*.{webp,png,jpg}",
  ],
  globIgnores: ["**/*.map", "**/node_modules/**"],
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.map((entry) => {
        const url = toUrl(entry.url);
        // Файли _next/static мають хеш у назві — ревізія не потрібна.
        return { ...entry, url, revision: url.startsWith("/_next/static/") ? null : entry.revision };
      }),
      warnings: [],
    }),
  ],
});

for (const warning of warnings) console.warn(`[build-sw] ${warning}`);
console.log(`[build-sw] public/sw.js: precache ${count} файлів, ${(size / 1024 / 1024).toFixed(2)} МБ`);
