/**
 * Як запропонувати встановлення застосунку — чисті функції (без window).
 *  - installed — уже відкрито як застосунок (display-mode: standalone);
 *  - prompt    — Chrome / Android дав подію beforeinstallprompt: кнопка;
 *  - ios       — Safari на iPhone / iPad (події немає): підказка
 *                «Поділитися → На екран „Додому“»;
 *  - none      — нічого не показуємо.
 */
export type InstallMode = "installed" | "prompt" | "ios" | "none";

/**
 * Inline-скрипт для <head>: beforeinstallprompt може прийти раніше, ніж
 * React гідратує сторінку, — зберігаємо подію у window.__installPrompt
 * (її забирає captureInstallPrompt).
 */
export const EARLY_INSTALL_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e});`;

/** iPhone / iPad (iPadOS 13+ видає себе за Mac, але має сенсорний екран). */
export function isIOS(userAgent: string, maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Саме Safari: на iOS додати на екран "Додому" як PWA можна з Safari
 * (інші браузери й вбудовані переглядачі — Chrome, Firefox, Instagram… — ні).
 */
export function isIOSSafari(userAgent: string, maxTouchPoints = 0) {
  return (
    isIOS(userAgent, maxTouchPoints) &&
    /Safari\//i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\/|FBAN|FBAV|Instagram|Line\//i.test(userAgent)
  );
}

export function detectInstallMode(input: {
  /** matchMedia('(display-mode: standalone)') або navigator.standalone (iOS). */
  standalone: boolean;
  /** Є збережена подія beforeinstallprompt. */
  canPrompt: boolean;
  userAgent: string;
  maxTouchPoints?: number;
}): InstallMode {
  if (input.standalone) return "installed";
  if (input.canPrompt) return "prompt";
  if (isIOSSafari(input.userAgent, input.maxTouchPoints)) return "ios";
  return "none";
}
