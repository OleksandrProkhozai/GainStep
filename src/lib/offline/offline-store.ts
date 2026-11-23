import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { ClientPreferences } from "@/components/preferences/preferences-provider";
import type { OfflineKit } from "@/lib/workout/queries";
import { addFinish, removeFinish, type FinishTask } from "./outbox";

/** Активне тренування на пристрої — для «Повернутись до тренування». */
export interface ActiveWorkout {
  workoutId: string;
  name: string;
}

export interface OfflineState {
  active: ActiveWorkout | null;
  /** Завершені без мережі тренування, що чекають відправки. */
  finishes: readonly FinishTask[];
  /** Активна програма для старту без мережі (оновлюється на дашборді). */
  kit: OfflineKit | null;
  /** Налаштування (unit, відпочинок) — для екрана тренування без сервера. */
  preferences: ClientPreferences | null;
  /** Останнє тренування, завершення якого щойно дійшло до сервера (не зберігається). */
  lastSynced: string | null;
}

interface OfflineActions {
  setActive: (active: ActiveWorkout) => void;
  /** Прибирає активне, лише якщо це саме воно (інша вкладка могла почати нове). */
  clearActive: (workoutId: string) => void;
  queueFinish: (task: FinishTask) => void;
  finishSent: (workoutId: string) => void;
  dropFinish: (workoutId: string) => void;
  setKit: (kit: OfflineKit | null) => void;
  /** Після тренування історія змінилася — кеш програми треба оновити. */
  staleKit: () => void;
  setPreferences: (preferences: ClientPreferences) => void;
}

export const OFFLINE_STORAGE_KEY = "gainstep-offline";

/**
 * Дані для роботи без мережі — один ключ localStorage (декілька КБ: черга
 * завершень, програма з двома останніми тренуваннями кожної вправи).
 * Модульний стор: на сервері storage недоступний і стан лишається
 * початковим; useStore віддає під час гідратації початковий стан
 * (getInitialState), тож розбіжності HTML немає.
 */
export const offlineStore = createStore<OfflineState & OfflineActions>()(
  persist(
    (set) => ({
      active: null,
      finishes: [],
      kit: null,
      preferences: null,
      lastSynced: null,

      setActive: (active) => set({ active }),
      clearActive: (workoutId) => set((s) => (s.active?.workoutId === workoutId ? { active: null } : s)),
      queueFinish: (task) => set((s) => ({ finishes: addFinish(s.finishes, task) })),
      finishSent: (workoutId) =>
        set((s) => ({
          finishes: removeFinish(s.finishes, workoutId),
          active: s.active?.workoutId === workoutId ? null : s.active,
          lastSynced: workoutId,
        })),
      dropFinish: (workoutId) =>
        set((s) => ({
          finishes: removeFinish(s.finishes, workoutId),
          active: s.active?.workoutId === workoutId ? null : s.active,
        })),
      setKit: (kit) => set({ kit }),
      staleKit: () => set((s) => (s.kit ? { kit: { ...s.kit, loadedAt: "" } } : s)),
      setPreferences: (preferences) => set({ preferences }),
    }),
    {
      name: OFFLINE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ active, finishes, kit, preferences }) => ({ active, finishes, kit, preferences }),
    },
  ),
);

export function useOffline<T>(selector: (state: OfflineState & OfflineActions) => T): T {
  return useStore(offlineStore, selector);
}
