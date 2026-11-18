"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, Plus, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWeight } from "@/lib/units";
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
import { formatVolume } from "@/lib/units";

const pill =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

/** Десктоп (від lg): шапка + три колонки, як на макеті ноутбука. */
export function DesktopView() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DesktopHeader />
      <div className="grid flex-1 grid-cols-[220px_minmax(0,1fr)_240px] items-start gap-4 p-4 xl:grid-cols-[300px_minmax(0,1fr)_300px] xl:gap-5 xl:p-5">
        <section className="rounded-2xl border border-white/10 bg-card p-4 xl:p-5">
          <h2 className="mb-4 font-heading text-xl font-bold">Exercises</h2>
          <ExerciseList />
        </section>
        <ExercisePanel />
        <div className="flex flex-col gap-4 xl:gap-5">
          <RestCard />
          <StatsCard />
        </div>
      </div>
      <p className="pb-5 text-center text-xs text-muted-foreground">
        <Kbd>Enter</Kbd> — complete set · <Kbd>Space</Kbd> — pause timer · <Kbd>← →</Kbd> — switch
        exercise
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-sans text-foreground/70">{children}</kbd>;
}

function DesktopHeader() {
  const { name, programName, startedAt, requestFinish, finishing } = useScreen();
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-white/5 px-5 py-4 xl:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href="/"
          aria-label="Back to dashboard"
          className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
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
          Finish workout
        </button>
      </div>
    </header>
  );
}

function ExercisePanel() {
  const current = useCurrentExercise();
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
    <section className="min-w-0 rounded-2xl border border-white/10 bg-card p-5 xl:p-7">
      <div className="flex items-start justify-between gap-4">
        <h2 className="min-w-0 font-heading text-3xl leading-tight font-extrabold tracking-tight xl:text-[40px]">
          {exercise.name}
        </h2>
        <p className="shrink-0 pt-2 text-sm text-muted-foreground">
          Exercise {current.index + 1} of {current.total}
        </p>
      </div>
      <ExerciseTags exercise={exercise} className="mt-3" />
      <SuggestionBanner exercise={exercise} suggestion={current.suggestion} unit={unit} className="mt-4" />

      <div role="table" aria-label="Sets" className="mt-6">
        <div
          role="row"
          className="grid grid-cols-[24px_56px_minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-2 px-3 pb-2 text-sm text-muted-foreground xl:grid-cols-[44px_80px_minmax(0,1fr)_minmax(0,1fr)_96px]"
        >
          <span role="columnheader">Set</span>
          <span role="columnheader">Previous</span>
          <span role="columnheader" className="text-center">
            Weight
          </span>
          <span role="columnheader" className="text-center">
            Reps
          </span>
          <span role="columnheader" className="text-center">
            Done
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {sets.map((set) => (
            <div
              role="row"
              key={set.clientId}
              className={cn(
                "group grid grid-cols-[24px_56px_minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-2 rounded-xl px-3 py-2.5 transition-colors xl:grid-cols-[44px_80px_minmax(0,1fr)_minmax(0,1fr)_96px]",
                set.isCompleted ? "bg-primary/13" : "bg-white/3.5",
                !set.isCompleted && set.clientId === activeSet?.clientId && "ring-1 ring-white/15",
              )}
            >
              <span role="cell" className="pl-1 font-semibold">
                {set.setNumber}
              </span>
              <span role="cell" className="truncate text-sm text-muted-foreground tabular-nums">
                {formatSetResult(previousSet(exercise, set.setNumber), unit)}
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
                  label={set.isCompleted ? `Mark set ${set.setNumber} as not done` : `Complete set ${set.setNumber}`}
                  onClick={() => (set.isCompleted ? uncomplete(set.clientId) : completeSet(set.clientId))}
                />
                {prs.has(set.clientId) ? (
                  <PrBadge />
                ) : (
                  <button
                    type="button"
                    onClick={() => deleteSet(set.clientId)}
                    aria-label={`Delete set ${set.setNumber}`}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-white/5 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
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
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-sm font-medium text-foreground/85 transition hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden />
        Add set
      </button>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Est. 1RM today:{" "}
          <span className="ml-1 text-lg font-bold text-foreground">
            {current.e1rm > 0 ? formatWeight(current.e1rm, unit) : "—"}
          </span>
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => goTo(current.index - 1)}
            disabled={current.index === 0}
            className={cn(pill, "border border-white/40 hover:bg-white/5")}
          >
            Previous
          </button>
          {current.isLast ? (
            <button
              type="button"
              onClick={requestFinish}
              className={cn(pill, "bg-primary text-primary-foreground hover:bg-primary/90", allDone && "animate-pulse")}
            >
              Finish workout
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
              Next exercise
              <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatsCard() {
  const stats = useWorkoutStats();
  const { unit } = useScreen();
  const notes = useWorkout((s) => s.notes);
  const setNotes = useWorkout((s) => s.setNotes);
  const volume = formatVolume(stats.volumeKg, unit);

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <h2 className="font-heading text-lg font-bold">This workout</h2>
      <dl className="mt-4 grid grid-cols-3 divide-x divide-white/10 text-center">
        <div className="px-1">
          <dt className="sr-only">Volume</dt>
          <dd className="text-xl font-bold">
            {volume.value}
            <span className="ml-0.5 text-sm font-semibold">{volume.unit}</span>
          </dd>
          <dd className="text-xs text-muted-foreground">Volume</dd>
        </div>
        <div className="px-1">
          <dt className="sr-only">Sets done</dt>
          <dd className="text-xl font-bold">{stats.setsDone}</dd>
          <dd className="text-xs text-muted-foreground">Sets done</dd>
        </div>
        <div className="px-1">
          <dt className="sr-only">New PRs</dt>
          <dd className="text-xl leading-none font-bold">
            <Trophy className="mx-auto mb-1 size-4 text-amber-400" aria-hidden />
            {stats.prs}
          </dd>
          <dd className="text-xs text-muted-foreground">New PRs</dd>
        </div>
      </dl>
      <label htmlFor="workout-notes" className="mt-5 block font-semibold">
        Notes
      </label>
      <textarea
        id="workout-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="How did it feel?"
        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20"
      />
    </section>
  );
}
