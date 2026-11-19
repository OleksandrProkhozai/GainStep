"use client";

import { createContext, use, type ReactNode } from "react";
import type { WeightUnit } from "@/lib/units";

/** Налаштування, потрібні клієнтським компонентам. Джерело — getCurrentUser(). */
export interface ClientPreferences {
  unit: WeightUnit;
  /** Мінімальний відпочинок, с (0 — вимкнено). */
  minRestSeconds: number;
}

const PreferencesContext = createContext<Promise<ClientPreferences> | null>(null);

/**
 * Єдине клієнтське джерело unit і мінімального відпочинку. Layout передає
 * promise (не чекаючи його), а компоненти розгортають його через use()
 * у своїх Suspense-межах. Після збереження налаштувань router.refresh()
 * перерендерює layout з новим promise — усі екрани бачать нове значення.
 */
export function PreferencesProvider({
  preferences,
  children,
}: {
  preferences: Promise<ClientPreferences>;
  children: ReactNode;
}) {
  return <PreferencesContext value={preferences}>{children}</PreferencesContext>;
}

function usePreferences(): ClientPreferences {
  const promise = use(PreferencesContext);
  if (!promise) throw new Error("usePreferences must be used within a PreferencesProvider");
  return use(promise);
}

/** Одиниці ваги користувача (kg / lb). У базі вага завжди в кг. */
export function useUnit(): WeightUnit {
  return usePreferences().unit;
}

/**
 * Мінімальний відпочинок з налаштувань, с (0 — вимкнено). Застосовується
 * через effectiveRest() при показі й у таймері; після зміни в Settings
 * router.refresh() дає новий promise, тож наступний відпочинок — з новим мінімумом.
 */
export function useMinRest(): number {
  return usePreferences().minRestSeconds;
}
