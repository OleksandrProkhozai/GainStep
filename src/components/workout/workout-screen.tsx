"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { exerciseName } from "@/lib/i18n/names";
import { useStore } from "zustand";
import { useUnit } from "@/components/preferences/preferences-provider";
import { createClient } from "@/lib/supabase/client";
import { discardWorkout, finishWorkout } from "@/lib/workout/actions";
import { firstPending } from "@/lib/workout/derive";
import { createWorkoutStore, purgeOtherWorkouts, type WorkoutStore } from "@/lib/workout/store";
import { createSyncer } from "@/lib/workout/sync";
import type { WorkoutInit } from "@/lib/workout/types";
import { ScreenContext, WorkoutStoreContext, type ScreenApi } from "./context";
import { DesktopView } from "./desktop-view";
import { AddExerciseDialog, ConfirmDialog, NoteDialog } from "./dialogs";
import { playRestOverSound, primeAudio, useIsDesktop, useWakeLock } from "./hooks";
import { MobileView } from "./mobile-view";
import { WorkoutSkeleton } from "./workout-skeleton";

/** Сповіщення про кінець відпочинку показуємо, лише якщо він закінчився нещодавно. */
const REST_ALERT_WINDOW_MS = 60_000;

/**
 * Екран активного тренування (клієнтська частина).
 * Стан — у Zustand-сторі з persist у localStorage (ключ за id тренування),
 * тому перезавантаження сторінки нічого не губить. Підходи синхронізуються
 * з workout_sets у фоні; черга переживає офлайн.
 */
export function WorkoutScreen({ init }: { init: WorkoutInit }) {
  const [store] = useState(() => createWorkoutStore(init));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    purgeOtherWorkouts(init.workoutId);
    const unsub = store.persist.onFinishHydration(() => setHydrated(true));
    void store.persist.rehydrate();
    return unsub;
  }, [store, init.workoutId]);

  if (!hydrated) return <WorkoutSkeleton />;
  return (
    <WorkoutStoreContext.Provider value={store}>
      <Screen store={store} init={init} />
    </WorkoutStoreContext.Provider>
  );
}

function Screen({ store, init }: { store: WorkoutStore; init: WorkoutInit }) {
  // Одиниці — з налаштувань (не зі store): зміна unit одразу міняє показ,
  // а store і далі тримає кг.
  const unit = useUnit();
  const t = useTranslations("workout");
  const locale = useLocale();
  const errorText = useErrorText();
  const isDesktop = useIsDesktop();
  const [syncer] = useState(() => createSyncer(store, createClient()));
  const [dialog, setDialog] = useState<null | "finish" | "discard" | "add" | "note">(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finishing, startFinishing] = useTransition();

  useWakeLock();

  // ── Синхронізація: кожна зміна черги → відкладена відправка;
  //    'online' і періодична повторна спроба — для офлайну.
  useEffect(() => {
    if (Object.keys(store.getState().pending).length > 0) void syncer.flush();
    const unsub = store.subscribe((state, prev) => {
      if (state.pending !== prev.pending && Object.keys(state.pending).length > 0) {
        syncer.schedule();
      }
    });
    const onOnline = () => void syncer.flush();
    const onOffline = () => {
      if (Object.keys(store.getState().pending).length > 0) store.getState().setSyncStatus("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const retry = setInterval(() => {
      if (Object.keys(store.getState().pending).length > 0) void syncer.flush();
    }, 20_000);
    return () => {
      unsub();
      syncer.cancel();
      clearInterval(retry);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [store, syncer]);

  // ── Кінець відпочинку: таймер до endsAt (працює і після згортання вкладки).
  const restEndsAt = useStore(store, (s) => s.rest.endsAt);
  useEffect(() => {
    if (restEndsAt === null) return;
    const fire = () => {
      const late = Date.now() - restEndsAt;
      store.getState().stopRest();
      if (late > REST_ALERT_WINDOW_MS) return;
      playRestOverSound();
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      toast(t("toast.restOver"), { description: t("toast.restOverText") });
    };
    const id = setTimeout(fire, Math.max(0, restEndsAt - Date.now()));
    return () => clearTimeout(id);
  }, [restEndsAt, store, t]);

  // ── Дії екрана
  const completeSet = useCallback(
    (clientId: string) => {
      primeAudio(); // звук дозволений лише після дії користувача
      const set = store.getState().sets.find((s) => s.clientId === clientId);
      if (set?.weightKg === null) {
        toast.error(t("toast.enterWeight"));
        return;
      }
      const exercise = store.getState().complete(clientId, Date.now());
      if (!exercise) return;
      store.getState().startRest(exercise.restSeconds, Date.now());
      if (!firstPending(store.getState().sets, exercise.exerciseId)) {
        const { exercises, currentIndex } = store.getState();
        const next = exercises[currentIndex + 1];
        if (next) {
          toast.success(t("toast.exerciseDone", { name: exerciseName(exercise, locale) }), {
            description: t("toast.nextUp", { name: exerciseName(next, locale) }),
          });
        }
      }
    },
    [store, t, locale],
  );

  const finish = useCallback(() => {
    startFinishing(async () => {
      const synced = await syncer.flush();
      if (!synced) {
        toast.error(t("toast.notSynced"), {
          description: t("toast.notSyncedText"),
        });
        return;
      }
      // Стор чистимо до виклику: дія завершується редіректом на підсумок.
      store.persist.clearStorage();
      const result = await finishWorkout(init.workoutId, store.getState().notes);
      if (result?.error) {
        // Повертаємо стан у localStorage — тренування триває.
        store.setState({});
        toast.error(errorText(result.error));
      }
    });
  }, [store, syncer, init.workoutId, t, errorText]);

  const discard = useCallback(() => {
    startFinishing(async () => {
      syncer.cancel();
      store.persist.clearStorage();
      const result = await discardWorkout(init.workoutId);
      if (result?.error) {
        store.setState({});
        toast.error(errorText(result.error));
      }
    });
  }, [store, syncer, init.workoutId, errorText]);

  const requestFinish = useCallback(() => {
    const open = store.getState().sets.filter((s) => !s.isCompleted).length;
    if (open > 0) setDialog("finish");
    else finish();
  }, [store, finish]);

  const api = useMemo<ScreenApi>(
    () => ({
      workoutId: init.workoutId,
      name: init.name,
      programName: init.programName,
      startedAt: new Date(init.startedAt).getTime(),
      unit,
      completeSet,
      requestFinish,
      requestDiscard: () => setDialog("discard"),
      openAddExercise: () => {
        setSheetOpen(false);
        setDialog("add");
      },
      openNote: () => setDialog("note"),
      openExercises: () => setSheetOpen(true),
      finishing,
    }),
    [init, unit, completeSet, requestFinish, finishing],
  );

  // ── Гарячі клавіші (не в полях вводу й не у відкритих діалогах)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']")
      ) {
        return;
      }
      const onButton = el?.closest("button, a");
      const s = store.getState();
      switch (e.key) {
        case "Enter": {
          if (onButton) return; // Enter на кнопці — це її власне натискання
          const exercise = s.exercises[s.currentIndex];
          const target =
            s.sets.find((x) => x.clientId === s.expandedSetId && !x.isCompleted) ??
            (exercise ? firstPending(s.sets, exercise.exerciseId) : null);
          if (!target) return;
          e.preventDefault();
          completeSet(target.clientId);
          break;
        }
        case " ":
          if (onButton) return;
          if (s.rest.endsAt === null && s.rest.pausedRemaining === null) return;
          e.preventDefault();
          s.toggleRestPause(Date.now());
          break;
        case "ArrowLeft":
          e.preventDefault();
          s.goTo(s.currentIndex - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          s.goTo(s.currentIndex + 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, completeSet]);

  const openSets = useStore(store, (s) => s.sets.filter((x) => !x.isCompleted).length);

  return (
    <ScreenContext.Provider value={api}>
      {isDesktop ? <DesktopView /> : <MobileView sheetOpen={sheetOpen} onSheetOpenChange={setSheetOpen} />}

      <ConfirmDialog
        open={dialog === "finish"}
        onOpenChange={(o) => setDialog(o ? "finish" : null)}
        title={t("finishDialog.title")}
        description={t("finishDialog.text", { count: openSets })}
        confirmLabel={t("finish")}
        pending={finishing}
        onConfirm={finish}
      />
      <ConfirmDialog
        open={dialog === "discard"}
        onOpenChange={(o) => setDialog(o ? "discard" : null)}
        title={t("discardDialog.title")}
        description={t("discardDialog.text")}
        confirmLabel={t("discardDialog.confirm")}
        destructive
        pending={finishing}
        onConfirm={discard}
      />
      <AddExerciseDialog open={dialog === "add"} onOpenChange={(o) => setDialog(o ? "add" : null)} />
      <NoteDialog open={dialog === "note"} onOpenChange={(o) => setDialog(o ? "note" : null)} />
    </ScreenContext.Provider>
  );
}
