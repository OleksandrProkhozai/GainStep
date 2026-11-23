"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStore } from "zustand";
import { countUnsyncedSets } from "@/lib/offline/local-workout";
import type { WorkoutStore } from "@/lib/workout/store";
import { cn } from "@/lib/utils";
import { useOnline } from "./use-online";

/** Скільки висить "Синхронізовано ✓". */
export const SYNCED_VISIBLE_MS = 3_000;

/**
 * Невеликий pill угорі екрана: помаранчевий контур — офлайн,
 * лаймовий — щойно синхронізовано. Не перехоплює дотики.
 */
export function StatusPill({ tone, children }: { tone: "offline" | "synced"; children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 flex justify-center px-4 lg:top-24"
    >
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-lg shadow-black/40 backdrop-blur-xl animate-in fade-in slide-in-from-top-1",
          tone === "offline"
            ? "border-orange-400/80 bg-background/90 text-orange-300"
            : "border-primary bg-primary text-primary-foreground",
        )}
      >
        {tone === "offline" ? (
          <CloudOff className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden />
        )}
        <span className="truncate">{children}</span>
      </span>
    </div>
  );
}

/**
 * Стан мережі на екрані тренування: "Офлайн · N підходів чекають
 * синхронізації", а коли черга дійшла до сервера — "Синхронізовано ✓" на 3 с.
 */
export function ConnectionPill({ store }: { store: WorkoutStore }) {
  const t = useTranslations("offline.pill");
  const status = useStore(store, (s) => s.syncStatus);
  const unsynced = useStore(store, (s) => countUnsyncedSets(s));
  const online = useOnline();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const isOffline = () => !navigator.onLine || store.getState().syncStatus === "offline";
    let wasOffline = isOffline();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const off = isOffline();
      if (off) {
        wasOffline = true;
        clearTimeout(timer);
        setSynced(false);
      } else if (wasOffline && store.getState().syncStatus === "saved") {
        wasOffline = false;
        setSynced(true);
        clearTimeout(timer);
        timer = setTimeout(() => setSynced(false), SYNCED_VISIBLE_MS);
      }
    };
    const unsub = store.subscribe(check);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      unsub();
      clearTimeout(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, [store]);

  if (!online || status === "offline") return <StatusPill tone="offline">{t("offline", { count: unsynced })}</StatusPill>;
  if (synced) return <StatusPill tone="synced">{t("synced")}</StatusPill>;
  return null;
}
