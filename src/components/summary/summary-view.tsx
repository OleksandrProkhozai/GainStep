import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Dumbbell, Layers, ListChecks, Sparkles, Target, Timer, Trophy, X } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { PrBadge } from "@/components/workout/parts";
import { formatMinutes, toDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatVolume, formatWeight, formatWeightValue, type WeightUnit } from "@/lib/units";
import type { NextUp, SummaryPageData } from "@/lib/workout/summary-queries";
import type { SummaryExercise, SummaryRecord, SummarySet } from "@/lib/workout/summary";
import { formatSuggestionReason } from "@/lib/workout/suggestion-text";
import { NotesCard } from "./notes-card";
import { Card, CardTitle, Confetti, DoneBadge, pill, TrophyBurst } from "./parts";

// ───────────── Форматування ─────────────

/** "Push Day" → "Push" (для "vs last Push"). */
const shortDay = (name: string) => name.replace(/\s+day$/i, "") || name;

/** "Tue, Nov 18" — календарний день у поясі користувача. */
const formatDate = (iso: string) => format(parseISO(toDayKey(iso)), "EEE, MMM d");

/** "↑ +8%" / "↓ −5%" / "= 0%". */
function formatChange(pct: number) {
  const rounded = Math.round(pct);
  if (rounded > 0) return { text: `↑ +${rounded}%`, up: true };
  if (rounded < 0) return { text: `↓ −${Math.abs(rounded)}%`, up: false };
  return { text: "= 0%", up: false };
}

/** "62.5 kg × 12, 12, 12" або, якщо вага різна, "60 × 12, 62.5 × 10". */
function formatSets(sets: SummarySet[], unit: WeightUnit) {
  const sameWeight = sets.every((s) => s.weight === sets[0].weight);
  if (sameWeight) return `${formatWeight(sets[0].weight, unit)} × ${sets.map((s) => s.reps).join(", ")}`;
  return sets.map((s) => `${formatWeightValue(s.weight, unit)} × ${s.reps}`).join(", ");
}

const formatRecord = (r: SummaryRecord, unit: WeightUnit) =>
  `${r.name} — ${formatWeight(r.weight, unit)} × ${r.reps} · est. 1RM ${formatWeight(r.e1rm, unit)}`;

// ───────────── Сторінка ─────────────

/**
 * Екран підсумку тренування. Один набір карток для всіх ширин:
 * на lg — дві колонки як на макеті ноутбука; на телефоні колонки
 * "розчиняються" (display: contents), і картки йдуть у порядку макета
 * телефона завдяки order.
 */
export function SummaryView({ data }: { data: SummaryPageData }) {
  const { summary, unit } = data;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden">
      <header className="flex items-center justify-between gap-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pr-[calc(env(safe-area-inset-right)+0.5rem)] pl-[calc(env(safe-area-inset-left)+1rem)] lg:px-6 lg:pt-5">
        <Link
          href="/"
          aria-label="GainStep — dashboard"
          className="hidden rounded-lg focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none lg:block"
        >
          <Logo />
        </Link>
        <h1 className="sr-only">Workout summary</h1>
        <Link
          href="/"
          aria-label="Close summary"
          className="ml-auto flex size-11 items-center justify-center rounded-full transition hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:bg-white/5"
        >
          <X className="size-6" aria-hidden />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-[max(1rem,env(safe-area-inset-left))] pt-1 pb-4 lg:grid lg:max-w-[1240px] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:px-6 lg:pt-3 lg:pb-8 xl:gap-5">
        <div className="contents lg:flex lg:flex-col lg:gap-4 xl:gap-5">
          <Hero data={data} className="max-lg:order-1" />
          <Stats data={data} className="max-lg:order-2" />
          <ExercisesCard exercises={summary.exercises} unit={unit} className="max-lg:order-4" />
          <NotesCard workoutId={data.workoutId} initialNotes={data.notes} className="max-lg:order-6" />
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-4 xl:gap-5">
          <NextTimeCard exercises={summary.exercises} unit={unit} className="max-lg:order-3" />
          {data.nextUp && <NextUpCard nextUp={data.nextUp} className="max-lg:order-5" />}
          <div className="hidden flex-col gap-3 lg:flex">
            <Link href="/" className={cn(pill, "h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90")}>
              Done
            </Link>
            <Link href="/workouts" className={cn(pill, "h-12 w-full border border-white/40 text-base hover:bg-white/5")}>
              View history
            </Link>
          </div>
        </div>
      </main>

      {/* Телефон: закріплені кнопки знизу (в потоці — контент під ними не ховається) */}
      <div className="sticky bottom-0 z-20 bg-linear-to-t from-background from-70% to-background/0 pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pl-[max(1rem,env(safe-area-inset-left))] lg:hidden">
        <div className="mx-auto flex max-w-xl flex-col items-center">
          <Link href="/" className={cn(pill, "h-14 w-full bg-primary text-base text-primary-foreground")}>
            Done
          </Link>
          <Link
            href="/workouts"
            className="mt-1 inline-flex h-11 items-center px-4 text-sm font-semibold text-foreground/85 underline-offset-4 hover:underline focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            View history
          </Link>
        </div>
      </div>
    </div>
  );
}

// ───────────── Герой ─────────────

function Hero({ data, className }: { data: SummaryPageData; className?: string }) {
  const { summary, unit } = data;
  const top = summary.records[0];
  const hasPR = top !== undefined;

  let subtitle: string;
  if (hasPR) {
    subtitle = formatRecord(top, unit);
  } else if (summary.volumeChange !== null && data.dayName) {
    subtitle = `Volume ${formatChange(summary.volumeChange).text} vs last ${shortDay(data.dayName)}`;
  } else if (data.dayName) {
    subtitle = `First ${data.dayName} — great start!`;
  } else {
    subtitle = `${summary.setsDone} ${summary.setsDone === 1 ? "set" : "sets"} done — nice work!`;
  }

  return (
    <Card className={cn("relative overflow-hidden px-4 pt-4 pb-6 text-center lg:px-6 lg:pb-7", className)}>
      {hasPR && <Confetti />}
      <p className="flex justify-center lg:justify-start">
        <span className="inline-flex max-w-full flex-wrap justify-center gap-x-1 rounded-lg bg-white/8 px-2.5 py-1 text-xs font-medium text-foreground/85">
          <span>{data.name}</span>
          {data.programName && <span className="hidden lg:inline">· {data.programName}</span>}
          <span>· {formatDate(data.startedAt)}</span>
        </span>
      </p>
      <div className="mt-4 lg:mt-3">{hasPR ? <TrophyBurst /> : <DoneBadge />}</div>
      <div className="motion-safe:animate-summary-fade motion-safe:[animation-delay:150ms]">
        <h2 className="mt-3 font-heading text-[28px] leading-tight font-extrabold tracking-tight lg:text-[34px]">
          {hasPR
            ? summary.prCount === 1
              ? "New PR!"
              : `${summary.prCount} new PRs!`
            : "Workout complete!"}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-balance text-muted-foreground lg:text-[15px]">
          {subtitle}
          {hasPR && summary.records.length > 1 && (
            <span className="font-semibold text-amber-300"> +{summary.records.length - 1} more</span>
          )}
        </p>
      </div>
    </Card>
  );
}

// ───────────── Статистика ─────────────

function Stats({ data, className }: { data: SummaryPageData; className?: string }) {
  const { summary, unit } = data;
  const volume = formatVolume(summary.volumeKg, unit);
  const change = summary.volumeChange === null ? null : formatChange(summary.volumeChange);

  return (
    <dl className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      <Stat
        icon={<Timer className="size-6 text-orange-400" aria-hidden />}
        label="Duration"
        value={summary.durationMinutes === null ? "—" : formatMinutes(summary.durationMinutes)}
      />
      <Stat
        icon={<Dumbbell className="size-6 rotate-45 text-primary" aria-hidden />}
        label="Volume"
        value={
          <>
            {volume.value}
            <span className="ml-1">{volume.unit}</span>
          </>
        }
        extra={
          change && (
            <span className={cn("text-xs font-semibold", change.up ? "text-primary" : "text-muted-foreground")}>
              {change.text}
              {data.dayName && <span className="hidden lg:inline"> vs last {shortDay(data.dayName)}</span>}
            </span>
          )
        }
      />
      <Stat icon={<Layers className="size-6 text-amber-300" aria-hidden />} label="Sets" value={summary.setsDone} />
      <Stat icon={<Trophy className="size-6 text-amber-400" aria-hidden />} label="PRs" value={summary.prCount} />
    </dl>
  );
}

function Stat({
  icon,
  label,
  value,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-2xl border border-white/10 bg-card px-2 py-4 text-center">
      {/* dt — перший у DOM (семантика <dl>), візуально — під значенням */}
      <dt className="order-3 text-sm text-muted-foreground">{label}</dt>
      <span className="order-1">{icon}</span>
      <dd className="order-2 mt-2 font-heading text-[22px] leading-tight font-extrabold whitespace-nowrap tabular-nums lg:text-xl xl:text-2xl">
        {value}
      </dd>
      {extra && <dd className="order-4 mt-0.5">{extra}</dd>}
    </div>
  );
}

// ───────────── Вправи ─────────────

function ExercisesCard({
  exercises,
  unit,
  className,
}: {
  exercises: SummaryExercise[];
  unit: WeightUnit;
  className?: string;
}) {
  return (
    <Card className={className} aria-labelledby="exercises-heading">
      <CardTitle id="exercises-heading" icon={<ListChecks className="size-5 text-foreground/85" aria-hidden />}>
        Exercises
      </CardTitle>
      {exercises.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No completed sets in this workout.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {exercises.map((ex) => (
            <li key={ex.exerciseId} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-3">
                <p className="truncate text-[15px] font-medium">{ex.name}</p>
                <p className="truncate text-xs text-muted-foreground tabular-nums lg:text-sm">
                  {formatSets(ex.sets, unit)}
                </p>
              </div>
              {ex.record && <PrBadge />}
              <p className="w-[4.5rem] shrink-0 text-right text-sm font-semibold tabular-nums">
                <span className="sr-only">Est. 1RM </span>
                {ex.bestE1RM > 0 ? formatWeight(ex.bestE1RM, unit) : "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ───────────── Next time ─────────────

function NextPill({ ex, unit }: { ex: SummaryExercise; unit: WeightUnit }) {
  const base = "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap";
  switch (ex.next.action) {
    case "increase":
      return <span className={cn(base, "bg-primary text-primary-foreground")}>↑ +{formatWeight(ex.next.delta, unit)}</span>;
    case "deload":
      return <span className={cn(base, "bg-orange-400 text-[#1a0f00]")}>↓ deload −10%</span>;
    case "same":
      return <span className={cn(base, "bg-white/10 text-foreground/85")}>= same</span>;
    default:
      return <span className={cn(base, "bg-white/10 text-foreground/85")}>—</span>;
  }
}

function NextTimeCard({
  exercises,
  unit,
  className,
}: {
  exercises: SummaryExercise[];
  unit: WeightUnit;
  className?: string;
}) {
  return (
    <Card className={className} aria-labelledby="next-time-heading">
      <CardTitle id="next-time-heading" icon={<Sparkles className="size-5 text-amber-300" aria-hidden />}>
        Next time
      </CardTitle>
      <p className="mt-0.5 pl-[30px] text-xs text-muted-foreground">Calculated by double progression</p>
      {exercises.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Complete some sets to get suggestions.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {exercises.map((ex) => {
            const { next } = ex;
            const changed =
              (next.action === "increase" || next.action === "deload") && next.today !== null && next.weight !== null;
            return (
              <li key={ex.exerciseId} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSuggestionReason(next, ex, unit)}</p>
                </div>
                <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                  {next.weight === null
                    ? "—"
                    : changed
                      ? `${formatWeightValue(next.today!, unit)} → ${formatWeight(next.weight, unit)}`
                      : formatWeight(next.weight, unit)}
                </p>
                <NextPill ex={ex} unit={unit} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ───────────── Next up ─────────────

function NextUpCard({ nextUp, className }: { nextUp: NextUp; className?: string }) {
  return (
    <Card className={className} aria-labelledby="next-up-heading">
      <CardTitle id="next-up-heading" icon={<Target className="size-5 text-orange-400" aria-hidden />}>
        Next up
      </CardTitle>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl font-extrabold lg:text-2xl">{nextUp.name}</p>
          {nextUp.preview.length > 0 && (
            <p className="truncate text-xs text-muted-foreground lg:text-sm">
              {nextUp.preview.join(", ")}
              {nextUp.more > 0 && ` +${nextUp.more}`}
            </p>
          )}
        </div>
        <Link
          href="/programs"
          className={cn(pill, "h-10 shrink-0 border border-white/40 px-4 text-sm hover:bg-white/5")}
        >
          View program
        </Link>
      </div>
    </Card>
  );
}
