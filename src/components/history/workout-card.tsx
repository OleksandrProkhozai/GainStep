"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight, Pencil, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { useWeightFormat } from "@/components/i18n/use-format";
import type { HistoryWorkout } from "@/lib/history/derive";
import { exerciseName } from "@/lib/i18n/names";
import { cn } from "@/lib/utils";
import { dateBlock, durationText, exercisesPreview, volumeText } from "./format";
import { SetsTable } from "./sets-table";
import { ShareButton } from "./share-button";
import { WorkoutMenu } from "./workout-actions";

/** Лаймовий блок дати "19 / ЛИС". */
export function DateBlock({ dayKey, className }: { dayKey: string; className?: string }) {
  const locale = useLocale();
  const { day, month } = dateBlock(dayKey, locale);
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-accent-text",
        className,
      )}
    >
      <span className="font-heading text-[21px] leading-none font-extrabold">{day}</span>
      <span className="mt-1 text-[10px] leading-none font-bold tracking-[0.08em]">{month}</span>
    </span>
  );
}

export function PrCountBadge({ count, compact }: { count: number; compact?: boolean }) {
  const t = useTranslations("history.card");
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-primary/12 px-2.5 text-xs font-semibold whitespace-nowrap text-accent-text">
      <Trophy className="size-3.5" aria-hidden />
      {compact ? (
        <>
          <span aria-hidden>{count}</span>
          <span className="sr-only">{t("prs", { count })}</span>
        </>
      ) : (
        t("prs", { count })
      )}
    </span>
  );
}

export function DeloadBadge() {
  const t = useTranslations("history.card");
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-orange-400/15 px-2.5 text-xs font-semibold whitespace-nowrap text-orange-600 dark:text-orange-300">
      {t("deload")}
    </span>
  );
}

/** Вміст шапки картки (однаковий для посилання на телефоні й кнопки на desktop). */
function CardSummary({ workout, compact }: { workout: HistoryWorkout; compact?: boolean }) {
  const t = useTranslations("history.card");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const preview = exercisesPreview(workout.exercises, locale, compact ? 2 : 3);
  return (
    <>
      <DateBlock dayKey={workout.dayKey} className={compact ? "size-[52px]" : undefined} />
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-heading text-base font-bold lg:text-[17px]">{workout.name}</span>
          {workout.prCount > 0 && <PrCountBadge count={workout.prCount} compact={compact} />}
          {workout.deload && <DeloadBadge />}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-foreground/75 tabular-nums lg:text-[13px]">
          <span>{durationText(workout.stats.durationMinutes, locale)}</span>
          <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground/60" />
          <span>{volumeText(workout.stats.volumeKg, fmt.unit, locale)}</span>
          <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground/60" />
          <span>{t("sets", { count: workout.stats.setsDone })}</span>
        </span>
        {preview.names.length > 0 && (
          <span className="truncate text-xs text-muted-foreground lg:text-[13px]">
            {preview.names.join(", ")}
            {preview.more > 0 && ` ${t("more", { count: preview.more })}`}
          </span>
        )}
      </span>
    </>
  );
}

/**
 * Картка тренування в історії. Телефон — посилання на /workouts/[id];
 * desktop (lg+) — розгортається inline з таблицями підходів і кнопками
 * "Відкрити" / "Редагувати" / "Поділитися". Праворуч на обох — меню "…"
 * (Відкрити, Редагувати, Поділитися, Видалити).
 */
export function WorkoutCard({ workout }: { workout: HistoryWorkout }) {
  const t = useTranslations("history.card");
  const td = useTranslations("history.detail");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const href = `/workouts/${workout.id}`;

  return (
    <article
      className={cn(
        "rounded-[20px] border border-foreground/10 bg-card transition-colors",
        open && "lg:border-primary/30 lg:shadow-[0_0_0_1px_rgb(198_244_50/0.08)]",
      )}
    >
      {/* Телефон: посилання на сторінку + меню "…" поруч (не всередині посилання). */}
      <div className="flex items-center gap-1 pr-2 lg:hidden">
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] py-3.5 pl-3.5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:bg-foreground/3"
        >
          <CardSummary workout={workout} compact />
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
        <WorkoutMenu workout={workout} variant="card" />
      </div>

      {/* Desktop: кнопка розгортання + меню "…". */}
      <div className="hidden items-center gap-1 pr-3 lg:flex">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-[20px] py-3.5 pl-[18px] transition-colors hover:bg-foreground/2 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <CardSummary workout={workout} />
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition",
              open && "border border-foreground/15 text-foreground",
            )}
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </span>
        </button>
        <WorkoutMenu workout={workout} variant="card" />
      </div>

      {open && (
        <div id={panelId} className="hidden border-t border-foreground/8 lg:block">
          <div className="grid gap-x-6 gap-y-5 px-[18px] pt-4 pb-2 xl:grid-cols-2">
            {workout.exercises.map((ex) => {
              const name = exerciseName(ex, locale);
              return (
                <section key={ex.exerciseId} aria-label={name} className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-3">
                    <ExerciseThumb exercise={ex} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <SetsLine exercise={ex} />
                    </div>
                  </div>
                  <SetsTable sets={ex.sets} caption={name} />
                </section>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 px-[18px] pt-2 pb-4">
            <Link
              href={href}
              className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-accent-text transition hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <ArrowUpRight className="size-4" aria-hidden />
              {t("open")}
            </Link>
            <Link
              href={`${href}/edit`}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-foreground/25 px-5 text-sm font-bold transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98]"
            >
              <Pencil className="size-4" aria-hidden />
              {td("edit")}
            </Link>
            <ShareButton workout={workout} />
          </div>
        </div>
      )}
    </article>
  );
}

/** "4 × 80 кг × 10, 10, 9, 8" (однакова вага) або "4 підходи". */
function SetsLine({ exercise }: { exercise: HistoryWorkout["exercises"][number] }) {
  const fmt = useWeightFormat();
  const t = useTranslations("history.detail");
  const done = exercise.sets.filter((s) => s.isCompleted);
  if (done.length === 0) return <p className="text-xs text-muted-foreground">{t("setsSummary", { count: 0 })}</p>;
  const sameWeight = done.every((s) => s.weight === done[0].weight);
  const sep = fmt.locale === "uk" ? "; " : ", ";
  return (
    <p className="truncate text-xs text-muted-foreground tabular-nums">
      {sameWeight
        ? `${done.length} × ${fmt.weight(done[0].weight)} × ${done.map((s) => s.reps).join(sep)}`
        : t("setsSummary", { count: done.length })}
    </p>
  );
}
