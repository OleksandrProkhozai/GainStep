"use client";

import { Check, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { exerciseName } from "@/lib/i18n/names";
import { cn } from "@/lib/utils";
import { useScreen, useWorkout } from "./context";
import { AddedBadge, ProgressDots } from "./parts";
import { useExerciseProgress } from "./use-workout-view";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";

/** Список вправ з прогресом: ліва колонка на десктопі й шторка на телефоні. */
export function ExerciseList({ onPick }: { onPick?: () => void }) {
  const t = useTranslations("workout");
  const locale = useLocale();
  const items = useExerciseProgress();
  const currentIndex = useWorkout((s) => s.currentIndex);
  const goTo = useWorkout((s) => s.goTo);
  const { openAddExercise } = useScreen();

  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-col gap-1.5">
        {items.map(({ exercise, done, total, complete }, i) => {
          const active = i === currentIndex;
          return (
            <li key={exercise.exerciseId}>
              <button
                type="button"
                onClick={() => {
                  goTo(i);
                  onPick?.();
                }}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-xl border px-3.5 py-3 text-left transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary/7 shadow-[0_0_0_1px_var(--color-primary)]"
                    : "border-foreground/5 bg-foreground/2.5 hover:bg-foreground/5",
                )}
              >
                <ExerciseThumb exercise={exercise} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{exerciseName(exercise, locale)}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t("setsProgress", { done, total })}
                    {exercise.source === "added" && <AddedBadge />}
                  </span>
                </span>
                {complete ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" strokeWidth={3} aria-label={t("col.done")} />
                  </span>
                ) : (
                  <ProgressDots done={done} total={total} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={openAddExercise}
        className="mt-1.5 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/20 text-sm font-medium text-foreground/85 transition hover:border-primary/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden />
        {t("addExercise")}
      </button>
    </div>
  );
}
