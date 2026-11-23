"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { PreferencesProvider, type ClientPreferences } from "@/components/preferences/preferences-provider";
import { offlineStore } from "@/lib/offline/offline-store";
import { REST_LIMITS } from "@/lib/profile/schema";
import { initFromPersisted, readPersistedWorkout } from "@/lib/workout/store";
import type { WorkoutInit } from "@/lib/workout/types";
import { WorkoutScreen } from "./workout-screen";
import { WorkoutSkeleton } from "./workout-skeleton";

const noopSubscribe = () => () => {};

/** Прочитане з localStorage — один раз на сторінку (стабільне значення для useSyncExternalStore). */
const cache = new Map<string, WorkoutInit | null>();

function readOnce(workoutId: string, fallbackName: string) {
  if (!cache.has(workoutId)) {
    const persisted = readPersistedWorkout(workoutId);
    cache.set(workoutId, persisted ? initFromPersisted(persisted, fallbackName) : null);
  }
  return cache.get(workoutId)!;
}

const FALLBACK_PREFERENCES: ClientPreferences = {
  unit: "kg",
  minRestSeconds: REST_LIMITS.fallback,
  transitionRestEnabled: true,
};

/**
 * Екран тренування зі збереженого на пристрої стану — коли сервер дати
 * не може: без мережі (сторінка /offline, яку service worker віддає
 * замість /workout/[id]) або тренування почато офлайн і ще не створене
 * в базі. Немає локального стану — `fallback`.
 * cachedPreferences — налаштування з кешу пристрою (поза layout тренування).
 */
export function LocalWorkout({
  workoutId,
  fallback,
  cachedPreferences = false,
  onlyUncreated = false,
}: {
  workoutId: string;
  fallback: ReactNode;
  cachedPreferences?: boolean;
  /**
   * Лише тренування, почате без мережі й ще не створене в базі. Сервер
   * відповів "немає", а локально created = true — тренування видалили
   * (наприклад, з іншого пристрою), тож показуємо fallback.
   */
  onlyUncreated?: boolean;
}) {
  const t = useTranslations("workout");
  const init = useSyncExternalStore(
    noopSubscribe,
    () => readOnce(workoutId, t("metaTitle")),
    () => undefined,
  );

  if (init === undefined) return <WorkoutSkeleton />;
  if (init === null || (onlyUncreated && init.created !== false)) return fallback;
  const screen = <WorkoutScreen init={init} />;
  return cachedPreferences ? <CachedPreferences>{screen}</CachedPreferences> : screen;
}

/** Налаштування, збережені на пристрої (див. RememberPreferences). */
function CachedPreferences({ children }: { children: ReactNode }) {
  const [preferences] = useState(() =>
    Promise.resolve(offlineStore.getState().preferences ?? FALLBACK_PREFERENCES),
  );
  return <PreferencesProvider preferences={preferences}>{children}</PreferencesProvider>;
}

/** fallback для сторінки тренування: локального стану немає — 404. */
export function CallNotFound(): never {
  notFound();
}
