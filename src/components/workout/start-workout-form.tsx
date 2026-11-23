"use client";

import type { FormEvent, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { buildLocalWorkoutInit, newWorkoutId } from "@/lib/offline/local-workout";
import { offlineStore } from "@/lib/offline/offline-store";
import { startWorkout } from "@/lib/workout/actions";
import { createWorkoutStore, readPersistedWorkout } from "@/lib/workout/store";

/**
 * Форма старту тренування за днем програми. З мережею — server action
 * startWorkout (як і раніше). Без мережі — тренування створюється на
 * пристрої з кешованої програми (id — crypto.randomUUID), а рядок у базі
 * створить черга синхронізації, щойно з'явиться мережа.
 */
export function StartWorkoutForm({
  dayId,
  className,
  children,
}: {
  dayId: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("offline");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const { active, finishes, kit } = offlineStore.getState();
    // Почате без мережі й ще не створене на сервері — продовжуємо його,
    // а не створюємо друге (сервер про нього ще не знає).
    const local = active && !finishes.some((f) => f.workoutId === active.workoutId)
      ? readPersistedWorkout(active.workoutId)
      : null;
    const continueLocal = local !== null && (local.created === false || !navigator.onLine);
    if (navigator.onLine && !continueLocal) return; // звичайний старт через server action

    event.preventDefault();
    if (continueLocal) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- без мережі потрібна документна навігація: сторінку віддає service worker
      window.location.assign(`/workout/${local.workoutId}`);
      return;
    }

    const init = buildLocalWorkoutInit(kit, dayId, newWorkoutId(), new Date());
    if (!init) {
      toast.error(t("startUnavailable"), { description: t("startUnavailableText") });
      return;
    }
    // Зберігаємо стан у localStorage (setState записує persist) і відкриваємо
    // екран: service worker віддасть офлайн-сторінку, а вона збудує його зі стору.
    createWorkoutStore(init).setState({});
    offlineStore.getState().setActive({ workoutId: init.workoutId, name: init.name });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- без мережі потрібна документна навігація: сторінку віддає service worker
    window.location.assign(`/workout/${init.workoutId}`);
  };

  return (
    <form action={startWorkout.bind(null, dayId)} onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
}
