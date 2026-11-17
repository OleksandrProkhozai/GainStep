"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Поточний час, що оновлюється з інтервалом `ms` (для годинників). */
export function useNow(ms = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** true від брейкпойнта lg (1024px). Екран рендериться лише на клієнті. */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Screen Wake Lock: екран телефона не гасне під час тренування.
 * Блокування знімається браузером при згортанні вкладки — тож
 * запитуємо його знову, коли вкладка повертається. Без підтримки — тихо.
 */
export function useWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (disposed) void lock.release().catch(() => {});
        else sentinel = lock;
      } catch {
        // відмова (енергозбереження тощо) — не критично
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

// ───────────── Звук завершення відпочинку (Web Audio) ─────────────

let audioCtx: AudioContext | null = null;

/**
 * Браузери дозволяють звук лише після дії користувача, тож контекст
 * створюємо/«будимо» в обробнику натискання (Complete set).
 */
export function primeAudio() {
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

/** Два короткі сигнали. */
export function playRestOverSound() {
  primeAudio();
  const ctx = audioCtx;
  if (!ctx) return;
  const start = ctx.currentTime;
  for (const offset of [0, 0.22]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    const t = start + offset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

// ───────────── Форматування часу ─────────────

const pad = (n: number) => String(n).padStart(2, "0");

/** 32:15 або 1:05:09 (тривалість тренування). */
export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 1:30 (відпочинок; округлення вгору, щоб 0:00 показувалось лише в кінці). */
export function formatRest(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}
