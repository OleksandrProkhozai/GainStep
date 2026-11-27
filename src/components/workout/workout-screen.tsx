"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { ConnectionPill } from "@/components/pwa/connection-pill";
import { exerciseName } from "@/lib/i18n/names";
import { useStore } from "zustand";
import { useMinRest, useTransitionRestEnabled, useUnit } from "@/components/preferences/preferences-provider";
import { completeFinish, sendFinishOnce } from "@/lib/offline/flush";
import { offlineStore, useOffline } from "@/lib/offline/offline-store";
import type { FinishTask } from "@/lib/offline/outbox";
import { createClient } from "@/lib/supabase/client";
import { discardWorkout } from "@/lib/workout/actions";
import { firstPending, planRest } from "@/lib/workout/derive";
import { createWorkoutStore, purgeOtherWorkouts, type WorkoutStore } from "@/lib/workout/store";
import { createSyncer } from "@/lib/workout/sync";
import { createWorkoutRow, savePlan } from "@/lib/workout/sync-actions";
import type { WorkoutInit } from "@/lib/workout/types";
import { ScreenContext, WorkoutStoreContext, type ScreenApi } from "./context";
import { DesktopView } from "./desktop-view";
import { AddExerciseDialog, ConfirmDialog, NoteDialog, RemoveExerciseDialog } from "./dialogs";
import { playRestOverSound, primeAudio, useIsDesktop, useWakeLock } from "./hooks";
import { LocalSummary } from "./local-summary";
import { MobileView } from "./mobile-view";
import { WorkoutSkeleton } from "./workout-skeleton";

/** Сповіщення про кінець відпочинку показуємо, лише якщо він закінчився нещодавно. */
const REST_ALERT_WINDOW_MS = 60_000;
/** Скільки висить toast "Вправу прибрано" з кнопкою "Повернути". */
const UNDO_MS = 5_000;

/**
 * Екран активного тренування (клієнтська частина).
 * Стан — у Zustand-сторі з persist у localStorage (ключ за id тренування),
 * тому перезавантаження сторінки нічого не губить. Підходи синхронізуються
 * з workout_sets у фоні; черга переживає офлайн.
 *
 * Без мережі екран будується з того самого стору (init — зі збереженого
 * стану, див. LocalWorkout). Завершене без мережі тренування стоїть у черзі
 * завершень — замість екрана показується локальний підсумок.
 */
export function WorkoutScreen({ init }: { init: WorkoutInit }) {
  // Одиниці — для кроку підказки ваги нових підходів (lb: 5 lb).
  const unit = useUnit();
  const [store] = useState(() => createWorkoutStore(init, unit));
  const [hydrated, setHydrated] = useState(false);
  const finishTask = useOffline((s) => s.finishes.find((f) => f.workoutId === init.workoutId) ?? null);

  useEffect(() => {
    // Стани тренувань, що чекають відправки завершення, не чіпаємо.
    const queued = offlineStore.getState().finishes.map((f) => f.workoutId);
    purgeOtherWorkouts([init.workoutId, ...queued]);
    const unsub = store.persist.onFinishHydration(() => setHydrated(true));
    void store.persist.rehydrate();
    return unsub;
  }, [store, init.workoutId]);

  // Активне тренування на пристрої — для «Повернутись до тренування» без мережі.
  useEffect(() => {
    if (!finishTask) offlineStore.getState().setActive({ workoutId: init.workoutId, name: init.name });
  }, [finishTask, init.workoutId, init.name]);

  if (!hydrated) return <WorkoutSkeleton />;
  return (
    <WorkoutStoreContext.Provider value={store}>
      {finishTask ? (
        <LocalSummary store={store} task={finishTask} programName={init.programName} />
      ) : (
        <Screen store={store} init={init} />
      )}
    </WorkoutStoreContext.Provider>
  );
}

function Screen({ store, init }: { store: WorkoutStore; init: WorkoutInit }) {
  // Одиниці — з налаштувань (не зі store): зміна unit одразу міняє показ,
  // а store і далі тримає кг.
  const unit = useUnit();
  // Мінімальний відпочинок читається в момент старту таймера: якщо його
  // змінили в Settings під час тренування, наступний відпочинок — уже з новим.
  const minRest = useMinRest();
  // "Довший відпочинок між вправами" — так само читається в момент старту таймера.
  const transitionRestEnabled = useTransitionRestEnabled();
  const t = useTranslations("workout");
  const tOffline = useTranslations("offline");
  const locale = useLocale();
  const errorText = useErrorText();
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const [syncer] = useState(() => createSyncer(store, createClient(), savePlan, createWorkoutRow));
  const [dialog, setDialog] = useState<null | "finish" | "discard" | "add" | "note">(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Вправа, прибирання якої треба підтвердити (є виконані підходи). */
  const [removing, setRemoving] = useState<string | null>(null);
  const [finishing, startFinishing] = useTransition();

  useWakeLock();

  // Тренування без збереженого складу (почате до появи exercise_plan) —
  // дозаписуємо склад, щоб він пережив інший пристрій.
  useEffect(() => {
    if (!init.planStored) store.getState().markPlanDirty();
  }, [store, init.planStored]);

  // ── Синхронізація: кожна зміна черги → відкладена відправка;
  //    'online' і періодична повторна спроба — для офлайну.
  useEffect(() => {
    // Є що відправити: зміни в черзі або тренування почато без мережі.
    const hasWork = () => {
      const s = store.getState();
      return Object.keys(s.pending).length > 0 || !s.created;
    };
    if (hasWork()) void syncer.flush();
    const unsub = store.subscribe((state, prev) => {
      if (state.pending !== prev.pending && Object.keys(state.pending).length > 0) {
        syncer.schedule();
      }
    });
    const onOnline = () => void syncer.flush();
    const onOffline = () => {
      if (hasWork()) store.getState().setSyncStatus("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const retry = setInterval(() => {
      if (hasWork()) void syncer.flush();
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
      // Останній підхід вправи (усі виконані, у будь-якому порядку) → перехідний
      // відпочинок до наступної невиконаної вправи; інакше — звичайний між підходами.
      const state = store.getState();
      const plan = planRest(exercise, state.exercises, state.sets, {
        minRestSeconds: minRest,
        transitionRestEnabled,
      });
      state.startRest(plan.seconds, Date.now(), plan.kind, plan.nextExerciseId);
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
    [store, t, locale, minRest, transitionRestEnabled],
  );

  /**
   * Завершення. З мережею — відправити підходи й finishWorkout, потім
   * підсумок із сервера. Без мережі (або якщо запит не дійшов) — у чергу
   * завершень: WorkoutScreen покаже локальний підсумок, а фонова черга
   * відправить усе, щойно з'явиться мережа. Помилка, яку повернув сервер, —
   * тост, тренування триває (як і раніше).
   */
  const finish = useCallback(() => {
    startFinishing(async () => {
      const state = store.getState();
      const task: FinishTask = {
        workoutId: init.workoutId,
        name: init.name,
        notes: state.notes,
        finishedAt: new Date().toISOString(),
      };
      const queueLocally = () => {
        state.stopRest();
        syncer.cancel();
        offlineStore.getState().queueFinish(task);
        toast.success(tOffline("finishedLocally"), { description: tOffline("finishedLocallyText") });
      };
      if (!navigator.onLine) return queueLocally();

      const attempt = await sendFinishOnce(task, { syncSets: () => syncer.flush(), complete: completeFinish });
      if (!attempt) return;
      if (attempt.kind === "done") {
        router.replace(`/workout/${init.workoutId}/summary`);
      } else if (attempt.kind === "drop") {
        toast.error(errorText(attempt.error));
        router.replace("/");
      } else if (attempt.error) {
        toast.error(errorText(attempt.error));
      } else {
        queueLocally();
      }
    });
  }, [store, syncer, init.workoutId, init.name, tOffline, errorText, router]);

  const discard = useCallback(() => {
    startFinishing(async () => {
      syncer.cancel();
      const localOnly = !store.getState().created;
      if (!navigator.onLine) {
        // Почате без мережі й ще не відправлене — скасовуємо лише на пристрої.
        if (!localOnly) {
          toast.error(tOffline("discardUnavailable"));
          return;
        }
        store.persist.clearStorage();
        offlineStore.getState().clearActive(init.workoutId);
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- без мережі потрібна документна навігація: сторінку віддає service worker
        window.location.assign("/");
        return;
      }
      store.persist.clearStorage();
      offlineStore.getState().clearActive(init.workoutId);
      try {
        const result = await discardWorkout(init.workoutId);
        if (result?.error) {
          store.setState({});
          toast.error(errorText(result.error));
        }
      } catch (error) {
        unstable_rethrow(error);
        store.setState({});
        toast.error(tOffline("discardUnavailable"));
      }
    });
  }, [store, syncer, init.workoutId, tOffline, errorText]);

  // ── Прибирання вправи: з виконаними підходами — через підтвердження,
  //    без них — одразу, з "Повернути" в toast.
  const removeExercise = useCallback(
    (exerciseId: string, undoable: boolean) => {
      const removed = store.getState().removeExercise(exerciseId);
      if (!removed) {
        toast.error(t("toast.lastExercise"));
        return;
      }
      const name = exerciseName(removed.exercise, locale);
      if (!undoable) {
        toast.success(t("toast.exerciseRemoved"), { description: name });
        return;
      }
      toast.success(t("toast.exerciseRemoved"), {
        description: name,
        duration: UNDO_MS,
        action: { label: t("toast.undo"), onClick: () => store.getState().restoreExercise(removed) },
      });
    },
    [store, t, locale],
  );

  const requestRemoveExercise = useCallback(
    (exerciseId: string) => {
      const { exercises, sets } = store.getState();
      if (exercises.length <= 1) {
        toast.error(t("toast.lastExercise"));
        return;
      }
      const done = sets.filter((s) => s.exerciseId === exerciseId && s.isCompleted).length;
      if (done > 0) setRemoving(exerciseId);
      else removeExercise(exerciseId, true);
    },
    [store, t, removeExercise],
  );

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
      requestRemoveExercise,
      openExercises: () => setSheetOpen(true),
      finishing,
    }),
    [init, unit, completeSet, requestFinish, requestRemoveExercise, finishing],
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
  const removingExercise = useStore(store, (s) => s.exercises.find((e) => e.exerciseId === removing) ?? null);
  const removingDone = useStore(
    store,
    (s) => s.sets.filter((x) => x.exerciseId === removing && x.isCompleted).length,
  );

  return (
    <ScreenContext.Provider value={api}>
      {isDesktop ? <DesktopView /> : <MobileView sheetOpen={sheetOpen} onSheetOpenChange={setSheetOpen} />}
      <ConnectionPill store={store} />

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
      <RemoveExerciseDialog
        exercise={removingExercise}
        doneSets={removingDone}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeExercise(removing, false);
          setRemoving(null);
        }}
      />
      <NoteDialog open={dialog === "note"} onOpenChange={(o) => setDialog(o ? "note" : null)} />
    </ScreenContext.Provider>
  );
}
