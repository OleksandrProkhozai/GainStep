"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useWeightFormat } from "@/components/i18n/use-format";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { exerciseName } from "@/lib/i18n/names";
import { cn } from "@/lib/utils";
import { previousSet } from "@/lib/workout/derive";
import type { WorkoutSet } from "@/lib/workout/types";
import { useScreen, useWorkout } from "./context";
import { ExerciseList } from "./exercise-list";
import {
  ExerciseTags,
  formatSetResult,
  PrBadge,
  RepsStepper,
  SaveStatus,
  SuggestionBanner,
  WeightStepper,
  WorkoutClock,
} from "./parts";
import { RestBar, useRestActive } from "./rest-timer";
import { useCurrentExercise, type CurrentExercise } from "./use-workout-view";
import { ExerciseMenu, WorkoutMenu } from "./workout-menu";

const pill =
  "inline-flex h-14 items-center justify-center gap-2 rounded-full px-5 text-base font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

/** Телефон (до lg): одна вправа на екрані, як на макетах. */
export function MobileView({
  sheetOpen,
  onSheetOpenChange,
}: {
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("workout");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const current = useCurrentExercise();
  const { startedAt, requestFinish, openAddExercise } = useScreen();
  const goTo = useWorkout((s) => s.goTo);
  const addSet = useWorkout((s) => s.addSet);
  const resting = useRestActive();
  if (!current) return null;
  const { exercise } = current;

  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-clip">
      <header className="sticky top-0 z-30 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1 border-b border-foreground/5 bg-background/90 pt-[calc(env(safe-area-inset-top)+0.5rem)] pr-[calc(env(safe-area-inset-right)+0.5rem)] pb-2 pl-[calc(env(safe-area-inset-left)+0.5rem)] backdrop-blur-xl">
        <Link
          href="/"
          aria-label={t("back")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full transition active:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <ChevronLeft className="size-7" aria-hidden />
        </Link>
        {/* min-h — місце під 2 рядки назви + "3 з 7": шапка не стрибає при перемиканні вправ.
            Шеврон — inline у кінці тексту, а не окремою колонкою: так назві лишається вся ширина. */}
        <button
          type="button"
          onClick={() => onSheetOpenChange(true)}
          aria-haspopup="dialog"
          className="flex min-h-[4.125rem] min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <span className="line-clamp-2 max-w-full min-w-0 text-center font-heading text-base leading-tight font-bold break-words">
            {exerciseName(exercise, locale)}
            <ChevronDown className="ml-1 inline size-4 shrink-0 align-[-2px] text-muted-foreground" aria-hidden />
          </span>
          <span className="mt-0.5 text-xs text-muted-foreground">
            {t("nOfTotal", { n: current.index + 1, total: current.total })}
          </span>
        </button>
        <div className="shrink-0">
          <WorkoutMenu mobile />
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-xl flex-1 flex-col pt-4 pr-[calc(env(safe-area-inset-right)+1rem)] pl-[calc(env(safe-area-inset-left)+1rem)]",
          resting ? "pb-[calc(env(safe-area-inset-bottom)+7rem)]" : "pb-[calc(env(safe-area-inset-bottom)+1.5rem)]",
        )}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <WorkoutClock startedAt={startedAt} className="text-2xl" />
          <SaveStatus compact />
        </div>

        <div className="mt-4 flex min-w-0 items-start gap-2">
          <ExerciseTags exercise={exercise} className="min-w-0 flex-1" />
          <ExerciseMenu exerciseId={exercise.exerciseId} className="-my-1.5" />
        </div>
        <SuggestionBanner
          exercise={exercise}
          suggestion={current.suggestion}
          className="mt-4 items-center text-center"
        />

        <SetList current={current} />

        <button
          type="button"
          onClick={() => addSet(exercise.exerciseId)}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/20 text-sm font-medium text-foreground/85 active:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden />
          {t("addSet")}
        </button>

        <p className="mt-5 text-sm text-muted-foreground">
          {t("e1rmToday")}{" "}
          <span className="font-semibold text-foreground">
            {current.e1rm > 0 ? fmt.weight(current.e1rm) : "—"}
          </span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => goTo(current.index - 1)}
            disabled={current.index === 0}
            className={cn(pill, "border border-foreground/40 active:bg-foreground/5")}
          >
            {t("previous")}
          </button>
          {current.isLast ? (
            <button type="button" onClick={requestFinish} className={cn(pill, "bg-primary text-primary-foreground")}>
              {t("finishShort")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(current.index + 1)}
              className={cn(pill, "bg-primary text-primary-foreground")}
            >
              <span className="line-clamp-2 break-words">{t("nextExercise")}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={openAddExercise}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-foreground/80 active:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden />
          {t("addExercise")}
        </button>
      </main>

      <RestBar />
      <ExercisesSheet open={sheetOpen} onOpenChange={onSheetOpenChange} />
    </div>
  );
}

function SetList({ current }: { current: CurrentExercise }) {
  const t = useTranslations("workout");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const { unit } = useScreen();
  const expand = useWorkout((s) => s.expand);
  const { exercise, sets, prs, activeSet, allDone } = current;

  return (
    <div className="mt-5">
      {/* На телефоні заголовки колонок не потрібні — картка підходу підписує поля сама. */}
      <div className="hidden grid-cols-[3rem_minmax(0,1fr)_52px_40px_76px] items-center gap-1.5 px-3 pb-2 text-sm text-muted-foreground sm:grid">
        <span className="truncate">{t("col.set")}</span>
        <span className="whitespace-nowrap">{t("col.previous")}</span>
        <span className="text-center">{fmt.unitLabel}</span>
        <span className="text-center">{t("col.reps")}</span>
        <span className="sr-only">{t("col.done")}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {sets.map((set) =>
          set.clientId === activeSet?.clientId ? (
            <ActiveSetCard key={set.clientId} set={set} current={current} />
          ) : (
            <button
              type="button"
              key={set.clientId}
              onClick={() => expand(set.clientId)}
              aria-label={t("editSetN", { n: set.setNumber })}
              className={cn(
                "grid min-h-14 w-full grid-cols-[2rem_minmax(0,1fr)_52px_40px_76px] sm:grid-cols-[3rem_minmax(0,1fr)_52px_40px_76px] items-center gap-1.5 rounded-xl px-3 text-left transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
                set.isCompleted ? "bg-primary/13" : "bg-foreground/3.5",
              )}
            >
              <span className="font-semibold">{set.setNumber}</span>
              <span className="truncate text-sm text-muted-foreground tabular-nums">
                {formatSetResult(previousSet(exercise, set.setNumber), unit, locale)}
              </span>
              <span className="text-center font-semibold tabular-nums">
                {set.weightKg === null ? "—" : fmt.value(set.weightKg)}
              </span>
              <span className="text-center font-semibold tabular-nums">{set.reps}</span>
              <span className="flex items-center justify-end gap-1">
                {set.isCompleted ? (
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" strokeWidth={3} aria-label={t("col.done")} />
                  </span>
                ) : (
                  <span className="size-7 rounded-full border-2 border-foreground/25" aria-hidden />
                )}
                {prs.has(set.clientId) && <PrBadge />}
              </span>
            </button>
          ),
        )}
        {allDone && !activeSet && <AllDoneCard current={current} />}
      </div>
    </div>
  );
}

/** Розгорнута картка поточного (або вибраного для редагування) підходу. */
function ActiveSetCard({ set, current }: { set: WorkoutSet; current: CurrentExercise }) {
  const t = useTranslations("workout");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const { unit, completeSet } = useScreen();
  const setWeight = useWorkout((s) => s.setWeight);
  const setReps = useWorkout((s) => s.setReps);
  const uncomplete = useWorkout((s) => s.uncomplete);
  const deleteSet = useWorkout((s) => s.deleteSet);
  const expand = useWorkout((s) => s.expand);
  const { exercise, prs } = current;

  return (
    <div className="min-w-0 rounded-2xl border-2 border-primary bg-foreground/3 p-3.5 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <p className="shrink-0 text-lg font-bold">{t("setN", { n: set.setNumber })}</p>
        <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight break-words text-muted-foreground">
          {t("previousValue", {
            // "62,5 × 12" переноситься лише цілим
            value: formatSetResult(previousSet(exercise, set.setNumber), unit, locale).replaceAll(" ", "\u00a0"),
          })}
        </p>
        {prs.has(set.clientId) && <PrBadge />}
        <button
          type="button"
          onClick={() => deleteSet(set.clientId)}
          aria-label={t("deleteSetN", { n: set.setNumber })}
          className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-foreground/5 active:text-destructive focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-center text-sm text-muted-foreground">{t("weightWithUnit", { unit: fmt.unitLabel })}</p>
          <WeightStepper
            size="lg"
            weightKg={set.weightKg}
            incrementKg={exercise.increment}
            unit={unit}
            onChange={(kg) => setWeight(set.clientId, kg)}
          />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-center text-sm text-muted-foreground">{t("col.reps")}</p>
          <RepsStepper size="lg" reps={set.reps} onChange={(r) => setReps(set.clientId, r)} />
        </div>
      </div>

      {set.isCompleted ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => uncomplete(set.clientId)}
            className={cn(pill, "h-12 border border-foreground/30 text-sm active:bg-foreground/5")}
          >
            {t("markNotDone")}
          </button>
          <button
            type="button"
            onClick={() => expand(null)}
            className={cn(pill, "h-12 bg-primary text-sm text-primary-foreground")}
          >
            {t("done")}
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => completeSet(set.clientId)}
          disabled={set.weightKg === null}
          className={cn(pill, "mt-4 w-full bg-primary text-lg text-primary-foreground")}
        >
          {t("completeSet")}
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </button>
      )}
    </div>
  );
}

function AllDoneCard({ current }: { current: CurrentExercise }) {
  const goTo = useWorkout((s) => s.goTo);
  const exercises = useWorkout((s) => s.exercises);
  const t = useTranslations("workout");
  const locale = useLocale();
  const { requestFinish } = useScreen();
  const next = exercises[current.index + 1];

  return (
    <div className="mt-1 rounded-2xl border border-primary/40 bg-primary/6 p-4 text-center">
      <p className="font-semibold">{t("allSetsDone")}</p>
      {next ? (
        <button
          type="button"
          onClick={() => goTo(current.index + 1)}
          className={cn(pill, "mt-3 h-auto min-h-12 w-full bg-primary py-2 text-primary-foreground")}
        >
          <span className="line-clamp-2 min-w-0 leading-tight break-words">{t("nextNamed", { name: exerciseName(next, locale) })}</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={requestFinish}
          className={cn(pill, "mt-3 h-12 w-full bg-primary text-primary-foreground")}
        >
          {t("finish")}
        </button>
      )}
    </div>
  );
}

/** Шторка зі списком вправ (тап по назві вправи в шапці). */
function ExercisesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("workout");
  const { requestFinish, finishing } = useScreen();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[88dvh] gap-0 rounded-t-3xl border-foreground/10 bg-card pr-[calc(env(safe-area-inset-right)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] pl-[calc(env(safe-area-inset-left)+1rem)]"
      >
        <div className="mx-auto mt-2.5 mb-3 h-1.5 w-12 rounded-full bg-foreground/25" aria-hidden />
        <SheetTitle className="font-heading text-2xl font-bold">{t("exercises")}</SheetTitle>
        <SheetDescription className="sr-only">{t("sheetDescription")}</SheetDescription>
        <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          <ExerciseList onPick={() => onOpenChange(false)} />
        </div>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            requestFinish();
          }}
          disabled={finishing}
          className={cn(pill, "mt-4 w-full shrink-0 bg-primary text-lg text-primary-foreground")}
        >
          {t("finish")}
        </button>
      </SheetContent>
    </Sheet>
  );
}
