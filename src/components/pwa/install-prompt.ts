"use client";

import { useSyncExternalStore } from "react";

/** Подія Chrome / Android "можна встановити" (немає в lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let captured = false;

/**
 * Ловимо beforeinstallprompt якомога раніше (з кореневого layout):
 * подія приходить одразу після завантаження, а кнопка — у Налаштуваннях.
 */
export function captureInstallPrompt() {
  if (captured || typeof window === "undefined") return;
  captured = true;
  // Подія могла прийти до гідратації — її зберіг inline-скрипт (EARLY_INSTALL_SCRIPT).
  const early = (window as { __installPrompt?: BeforeInstallPromptEvent }).__installPrompt;
  if (early) {
    deferred = early;
    emit();
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // власна кнопка замість міні-банера Chrome
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Є подія для кнопки "Встановити" (і застосунок ще не встановили щойно). */
export function useCanPromptInstall() {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null && !installed,
    () => false,
  );
}

/** Щойно встановили (appinstalled) — рядок ховається без перезавантаження. */
export function useJustInstalled() {
  return useSyncExternalStore(
    subscribe,
    () => installed,
    () => false,
  );
}

/** Показати системний діалог встановлення. true — користувач погодився. */
export async function promptInstall() {
  const event = deferred;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // Подію можна використати лише раз.
  deferred = null;
  emit();
  return outcome === "accepted";
}
