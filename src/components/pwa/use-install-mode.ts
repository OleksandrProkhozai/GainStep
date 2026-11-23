"use client";

import { useSyncExternalStore } from "react";
import { detectInstallMode, type InstallMode } from "@/lib/pwa/install-mode";
import { useCanPromptInstall, useJustInstalled } from "./install-prompt";

const STANDALONE = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Режим без події встановлення: installed / ios / none (рядок — стабільний знімок). */
function environmentMode(): InstallMode {
  return detectInstallMode({
    standalone:
      window.matchMedia(STANDALONE).matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    canPrompt: false,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

/**
 * Як запропонувати встановлення: кнопка (Chrome / Android), підказка
 * (Safari на iOS) або нічого (уже встановлено / браузер не вміє).
 * На сервері й під час гідратації — "none".
 */
export function useInstallMode(): InstallMode {
  const env = useSyncExternalStore(subscribe, environmentMode, () => "none" as InstallMode);
  const canPrompt = useCanPromptInstall();
  const justInstalled = useJustInstalled();
  if (justInstalled || env === "installed") return "installed";
  if (canPrompt) return "prompt";
  return env;
}
