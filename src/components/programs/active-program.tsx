"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { offlineStore } from "@/lib/offline/offline-store";
import { setActiveProgram } from "@/lib/programs/actions";
import { getOfflineKit } from "@/lib/workout/actions";

export type ActivatableProgram = { id: string; name: string };

type ActiveProgramState = {
  /** Активна програма з урахуванням оптимістичного перемикання. */
  activeId: string | null;
  pending: boolean;
  activate: (program: ActivatableProgram) => void;
};

const ActiveProgramContext = createContext<ActiveProgramState | null>(null);

/** Кеш активної програми на пристрої (офлайн-старт) — одразу на нову програму. */
function refreshOfflineKit() {
  if (!navigator.onLine) {
    offlineStore.getState().staleKit();
    return;
  }
  getOfflineKit()
    .then((kit) => offlineStore.getState().setKit(kit))
    .catch(() => offlineStore.getState().staleKit());
}

/**
 * Сама дія «Зробити активною»: server action (revalidatePath сторінок
 * програм, дашборду й /workouts) + router.refresh() поточного екрана,
 * toast, оновлення офлайн-кешу. Повертає true при успіху.
 */
export function useActivateProgramAction() {
  const t = useTranslations("programs.active");
  const errorText = useErrorText();
  const router = useRouter();
  return useCallback(
    async ({ id, name }: ActivatableProgram) => {
      const result = await setActiveProgram(id);
      if (!result.ok) {
        toast.error(errorText(result.error));
        return false;
      }
      toast.success(t("activated", { name }));
      router.refresh();
      refreshOfflineKit();
      return true;
    },
    [errorText, router, t],
  );
}

/**
 * Активна програма для групи компонентів (список, редактор, перемикач на
 * «Сьогодні»): перемикання оптимістичне — бейдж «Активна» і порядок карток
 * змінюються одразу, а після відповіді сервера activeId приходить з пропсів.
 */
export function ActiveProgramProvider({ activeId, children }: { activeId: string | null; children: ReactNode }) {
  const [optimisticId, setOptimisticId] = useOptimistic(activeId);
  const [pending, startTransition] = useTransition();
  const run = useActivateProgramAction();

  const activate = useCallback(
    (program: ActivatableProgram) =>
      startTransition(async () => {
        setOptimisticId(program.id);
        await run(program);
      }),
    [run, setOptimisticId],
  );

  const value = useMemo(() => ({ activeId: optimisticId, pending, activate }), [optimisticId, pending, activate]);
  return <ActiveProgramContext.Provider value={value}>{children}</ActiveProgramContext.Provider>;
}

/** Стан активної програми з найближчого ActiveProgramProvider. */
export function useActiveProgram(): ActiveProgramState {
  const value = useContext(ActiveProgramContext);
  if (!value) throw new Error("useActiveProgram: немає ActiveProgramProvider");
  return value;
}
