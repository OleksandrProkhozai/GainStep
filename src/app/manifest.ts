import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE } from "@/i18n/config";
import en from "../../messages/en.json";
import uk from "../../messages/uk.json";

/** Колір фону застосунку (і сплеш-екрана при запуску з іконки). */
const APP_BACKGROUND = "#0E0F11";

/**
 * Web App Manifest → /manifest.webmanifest. Статичний (без даних запиту),
 * тож тексти — мовою за замовчуванням, а не мовою користувача.
 */
export default function manifest(): MetadataRoute.Manifest {
  const messages = { en, uk }[DEFAULT_LOCALE];
  return {
    id: "/",
    name: "GainStep",
    short_name: "GainStep",
    description: messages.common.meta.description,
    lang: DEFAULT_LOCALE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: APP_BACKGROUND,
    theme_color: APP_BACKGROUND,
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: messages.pwa.shortcutStart,
        short_name: messages.pwa.shortcutStartShort,
        url: "/workouts",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
