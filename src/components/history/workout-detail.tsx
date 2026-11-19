import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import type { HistoryWorkout } from "@/lib/history/derive";
import { HISTORY_PATH } from "@/lib/history/url";
import { exerciseName } from "@/lib/i18n/names";
import { createWeightFormat, formatNumber, kgToUnit, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { longDateTime } from "./format";
import { SetsTable } from "./sets-table";
import { WorkoutBottomBar, WorkoutHeaderActions, WorkoutMenu } from "./workout-actions";
import { DeloadBadge } from "./workout-card";

/** "1:05" (год:хв) — компактна тривалість для картки статистики. */
function clockDuration(minutes: number | null) {
  if (minutes === null) return "—";
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Сторінка завершеного тренування з історії. */
export function WorkoutDetail({ workout, unit }: { workout: HistoryWorkout; unit: WeightUnit }) {
  const t = useTranslations("history.detail");
  const locale = useLocale();
  const fmt = createWeightFormat(unit, locale);

  const stats = [
    { value: clockDuration(workout.stats.durationMinutes), label: t("duration") },
    { value: formatNumber(Math.round(kgToUnit(workout.stats.volumeKg, unit)), locale), label: fmt.unitLabel },
    { value: String(workout.stats.setsDone), label: t("sets", { count: workout.stats.setsDone }) },
    { value: String(workout.prCount), label: t("records", { count: workout.prCount }), pr: true },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl pb-40 md:pb-4">
      <header className="flex items-center gap-3">
        <Link
          href={HISTORY_PATH}
          aria-label={t("back")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-card transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 max-md:text-center">
          <h1 className="flex items-center gap-2 font-heading text-xl leading-tight font-extrabold tracking-tight max-md:justify-center md:text-[28px]">
            <span className="truncate">{workout.name}</span>
            {workout.deload && <DeloadBadge />}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
            {longDateTime(workout.startedAt, workout.dayKey, locale)}
          </p>
        </div>
        <WorkoutHeaderActions workout={workout} />
        <WorkoutMenu workout={workout} />
      </header>

      <dl className="mt-5 grid grid-cols-4 gap-2 md:gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "flex min-w-0 flex-col-reverse items-center rounded-2xl border px-1 py-2.5 text-center md:py-4",
              s.pr ? "border-primary/30 bg-primary/8" : "border-foreground/10 bg-card",
            )}
          >
            <dt className={cn("truncate text-[11px] md:text-xs", s.pr ? "text-accent-text" : "text-muted-foreground")}>
              {s.label}
            </dt>
            <dd
              className={cn(
                "flex items-center gap-1 font-heading text-base font-extrabold tabular-nums md:text-2xl",
                s.pr && "text-accent-text",
              )}
            >
              {s.pr && <Trophy className="size-4 md:size-5" aria-hidden />}
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-col gap-3">
        {workout.exercises.map((ex) => {
          const name = exerciseName(ex, locale);
          const done = ex.sets.filter((s) => s.isCompleted);
          const top = done.length > 0 ? Math.max(...done.map((s) => s.weight)) : null;
          return (
            <section
              key={ex.exerciseId}
              aria-label={name}
              className="rounded-[20px] border border-foreground/10 bg-card px-3 pt-3 pb-1.5 md:px-5 md:pt-4"
            >
              <div className="mb-1.5 flex items-center gap-3">
                <ExerciseThumb exercise={ex} size="md" />
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold">{name}</h2>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("setsSummary", { count: done.length })}
                    {top !== null && ` · ${fmt.weight(top)}`}
                  </p>
                </div>
              </div>
              <SetsTable sets={ex.sets} variant="detail" caption={name} />
            </section>
          );
        })}

        {workout.notes && (
          <p className="rounded-2xl border border-foreground/10 bg-card px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-foreground/90">
            <span className="font-semibold text-muted-foreground">{t("notes")}: </span>
            {workout.notes}
          </p>
        )}
      </div>

      <WorkoutBottomBar workout={workout} />
    </div>
  );
}
