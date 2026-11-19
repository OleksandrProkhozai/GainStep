"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, Plus, Trash2, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useWeightFormat } from "@/components/i18n/use-format";
import { exerciseName } from "@/lib/i18n/names";
import { cn } from "@/lib/utils";
import { previousSet } from "@/lib/workout/derive";
import { useScreen, useWorkout } from "./context";
import { ExerciseList } from "./exercise-list";
import {
  DoneButton,
  ExerciseTags,
  formatSetResult,
  PrBadge,
  RepsStepper,
  SaveStatus,
  SuggestionBanner,
  WeightStepper,
  WorkoutClock,
} from "./parts";
import { RestCard } from "./rest-timer";
import { WorkoutMenu } from "./workout-menu";
import { useCurrentExercise, useWorkoutStats } from "./use-workout-view";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";

const pill =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

/** Десктоп (від lg): шапка + три колонки, як на макеті ноутбука. */
export function DesktopView() {
  const t = useTranslations("workout");
  return (
    <div className="flex min-h-dvh flex-col">
      <DesktopHeader />
      <div className="grid flex-1 grid-cols-[220px_minmax(0,1fr)_240px] items-start gap-4 p-4 xl:grid-cols-[300px_minmax(0,1fr)_300px] xl:gap-5 xl:p-5">
        <section className="rounded-2xl border border-foreground/10 bg-card p-4 xl:p-5">
          <h2 className="mb-4 font-heading text-xl font-bold">{t("exercises")}</h2>
          <ExerciseList />
        </section>
        <ExercisePanel />
        <div className="flex flex-col gap-4 xl:gap-5">
          <RestCard />
          <StatsCard />
        </div>
      </div>
      <p className="pb-5 text-center text-xs text-muted-foreground">
        {t.rich("shortcuts", { kbd: (chunks) => <Kbd>{chunks}</Kbd> })}
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-sans text-foreground/70">{children}</kbd>;
}

function DesktopHeader() {
  const t = useTranslations("workout");
  const { name, programName, startedAt, requestFinish, finishing } = useScreen();
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-foreground/5 px-5 py-4 xl:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href="/"
          aria-label={t("back")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <ChevronLeft className="size-7" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl leading-tight font-extrabold">{name}</h1>
          {programName && <p className="truncate text-sm text-muted-foreground">{programName}</p>}
        </div>
      </div>
      <WorkoutClock startedAt={startedAt} className="text-[44px] leading-none" />
      <div className="flex items-center justify-end gap-3">
        <SaveStatus />
        <WorkoutMenu />
        <button
          type="button"
          onClick={requestFinish}
          disabled={finishing}
          className={cn(pill, "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {t("finish")}
        </button>
      </div>
    </header>
  );
}

function ExercisePanel() {
  const current = useCurrentExercise();
  const t = useTranslations("workout");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const { unit, completeSet, requestFinish } = useScreen();
  const goTo = useWorkout((s) => s.goTo);
  const setWeight = useWorkout((s) => s.setWeight);
  const setReps = useWorkout((s) => s.setReps);
  const uncomplete = useWorkout((s) => s.uncomplete);
  const deleteSet = useWorkout((s) => s.deleteSet);
  const addSet = useWorkout((s) => s.addSet);
  if (!current) return null;
  const { exercise, sets, prs, activeSet, allDone } = current;

  return (
    <section className="min-w-0 rounded-2xl border border-foreground/10 bg-card p-5 xl:p-7">
      <div className="flex items-start justify-between gap-4">
        <ExerciseThumb exercise={exercise} className="mt-1 xl:size-14" />
        <h2 className="min-w-0 flex-1 font-heading text-3xl leading-tight font-extrabold tracking-tight xl:text-[40px]">
          {exerciseName(exercise, locale)}
        </h2>
        <p className="shrink-0 pt-2 text-sm text-muted-foreground">
          {t("exerciseOf", { n: current.index + 1, total: current.total })}
        </p>
      </div>
      <ExerciseTags exercise={exercise} className="mt-3" />
      <SuggestionBanner exercise={exercise} suggestion={current.suggestion} className="mt-4" />

      <div role="table" aria-label={t("sets")} className="mt-6">
        <div
          role="row"
          className="grid grid-cols-[24px_56px_minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-2 px-3 pb-2 text-sm text-muted-foreground xl:grid-cols-[44px_80px_minmax(0,1fr)_minmax(0,1fr)_96px]"
        >
          <span role="columnheader">{t("col.set")}</span>
          <span role="columnheader">{t("col.previous")}</span>
          <span role="columnheader" className="text-center">
            {t("col.weight")}
          </span>
          <span role="columnheader" className="text-center">
            {t("col.reps")}
          </span>
          <span role="columnheader" className="text-center">
            {t("col.done")}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {sets.map((set) => (
            <div
              role="row"
              key={set.clientId}
              className={cn(
                "group grid grid-cols-[24px_56px_minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-2 rounded-xl px-3 py-2.5 transition-colors xl:grid-cols-[44px_80px_minmax(0,1fr)_minmax(0,1fr)_96px]",
                set.isCompleted ? "bg-primary/13" : "bg-foreground/3.5",
                !set.isCompleted && set.clientId === activeSet?.clientId && "ring-1 ring-foreground/15",
              )}
            >
              <span role="cell" className="pl-1 font-semibold">
                {set.setNumber}
              </span>
              <span role="cell" className="truncate text-sm text-muted-foreground tabular-nums">
                {formatSetResult(previousSet(exercise, set.setNumber), unit, locale)}
              </span>
              <span role="cell" className="flex justify-center">
                <WeightStepper
                  weightKg={set.weightKg}
                  incrementKg={exercise.increment}
                  unit={unit}
                  onChange={(kg) => setWeight(set.clientId, kg)}
                />
              </span>
              <span role="cell" className="flex justify-center">
                <RepsStepper reps={set.reps} onChange={(r) => setReps(set.clientId, r)} />
              </span>
              <span role="cell" className="relative flex items-center justify-center gap-1.5">
                <DoneButton
                  done={set.isCompleted}
                  label={set.isCompleted ? t("markNotDoneN", { n: set.setNumber }) : t("completeSetN", { n: set.setNumber })}
                  onClick={() => (set.isCompleted ? uncomplete(set.clientId) : completeSet(set.clientId))}
                />
                {prs.has(set.clientId) ? (
                  <PrBadge />
                ) : (
                  <button
                    type="button"
                    onClick={() => deleteSet(set.clientId)}
                    aria-label={t("deleteSetN", { n: set.setNumber })}
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-foreground/5 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => addSet(exercise.exerciseId)}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/20 text-sm font-medium text-foreground/85 transition hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden />
        {t("addSet")}
      </button>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("e1rmToday")}{" "}
          <span className="ml-1 text-lg font-bold text-foreground">
            {current.e1rm > 0 ? fmt.weight(current.e1rm) : "—"}
          </span>
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => goTo(current.index - 1)}
            disabled={current.index === 0}
            className={cn(pill, "border border-foreground/40 hover:bg-foreground/5")}
          >
            {t("previous")}
          </button>
          {current.isLast ? (
            <button
              type="button"
              onClick={requestFinish}
              className={cn(pill, "bg-primary text-primary-foreground hover:bg-primary/90", allDone && "animate-pulse")}
            >
              {t("finish")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(current.index + 1)}
              className={cn(
                pill,
                "bg-primary text-primary-foreground hover:bg-primary/90",
                allDone && "shadow-[0_0_0_4px_rgb(198_244_50/0.25)]",
              )}
            >
              {t("nextExercise")}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatsCard() {
  const t = useTranslations("workout");
  const stats = useWorkoutStats();
  const fmt = useWeightFormat();
  const notes = useWorkout((s) => s.notes);
  const setNotes = useWorkout((s) => s.setNotes);
  const volume = fmt.volume(stats.volumeKg);

  return (
    <section className="rounded-2xl border border-foreground/10 bg-card p-5">
      <h2 className="font-heading text-lg font-bold">{t("thisWorkout")}</h2>
      <dl className="mt-4 grid grid-cols-3 divide-x divide-foreground/10 text-center">
        <div className="px-1">
          <dt className="sr-only">{t("volume")}</dt>
          <dd className="text-xl font-bold">
            {volume.value}
            <span className="ml-0.5 text-sm font-semibold">{volume.unit}</span>
          </dd>
          <dd className="text-xs text-muted-foreground">{t("volume")}</dd>
        </div>
        <div className="px-1">
          <dt className="sr-only">{t("setsDone")}</dt>
          <dd className="text-xl font-bold">{stats.setsDone}</dd>
          <dd className="text-xs text-muted-foreground">{t("setsDone")}</dd>
        </div>
        <div className="px-1">
          <dt className="sr-only">{t("newPrs")}</dt>
          <dd className="text-xl leading-none font-bold">
            <Trophy className="mx-auto mb-1 size-4 text-amber-400" aria-hidden />
            {stats.prs}
          </dd>
          <dd className="text-xs text-muted-foreground">{t("newPrs")}</dd>
        </div>
      </dl>
      <label htmlFor="workout-notes" className="mt-5 block font-semibold">
        {t("notes")}
      </label>
      <textarea
        id="workout-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={t("notesPlaceholder")}
        className="mt-2 w-full resize-none rounded-xl border border-foreground/10 bg-background/70 px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20"
      />
    </section>
  );
}
