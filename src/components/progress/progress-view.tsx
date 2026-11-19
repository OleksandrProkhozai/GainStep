"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChartLine, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BodyWeightEntry } from "@/lib/progress/body-weight";
import { summarizeRange, type ExerciseHistory } from "@/lib/progress/derive";
import { useUnit } from "@/components/preferences/preferences-provider";
import { toDisplayWeight } from "@/lib/units";
import { cn } from "@/lib/utils";
import { BodyWeightCard } from "./body-weight-card";
import { ExerciseChart } from "./exercise-chart";
import { useLocale, useTranslations } from "next-intl";
import { exerciseName } from "@/lib/i18n/names";
import { Card, Delta, useProgressFormat } from "./parts";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";

const RANGES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 91 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
  { key: "All", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Сторінка "Progress": заголовок із вибором вправи й періоду, картки
 * показників і графік вправи. Картки, що не залежать від вправи
 * (рекорди, тоннаж, вага тіла), приходять готовими із сервера як слоти.
 *
 * Телефон: усе в одну колонку (графік → тоннаж → рекорди → вага тіла).
 * lg+: дві колонки — графік і тоннаж ліворуч, рекорди й вага тіла праворуч.
 */
export function ProgressView({
  exercises,
  initialExerciseId,
  now,
  records,
  volume,
  bodyWeight,
}: {
  exercises: ExerciseHistory[];
  initialExerciseId: string | null;
  /** Момент рендеру на сервері — щоб фільтр періоду був детермінованим. */
  now: number;
  records: ReactNode;
  volume: ReactNode;
  /** Записи ваги тіла, від старих до нових. */
  bodyWeight: BodyWeightEntry[];
}) {
  const unit = useUnit();
  const t = useTranslations("progress");
  const pf = useProgressFormat();
  const unitText = pf.unit(unit);
  const [exerciseId, setExerciseId] = useState(initialExerciseId);
  const [range, setRange] = useState<RangeKey>("3M");
  const exercise = exercises.find((e) => e.id === exerciseId) ?? exercises[0] ?? null;

  const days = RANGES.find((r) => r.key === range)!.days;
  const periodFrom = days === null ? null : now - days * DAY_MS;

  const summary = useMemo(
    () => (exercise ? summarizeRange(exercise.sessions, periodFrom) : null),
    [exercise, periodFrom],
  );

  const selectExercise = (id: string) => {
    setExerciseId(id);
    // Вибір зберігаємо в адресі: після перезавантаження або "Назад" — та сама вправа.
    window.history.replaceState(null, "", `?exercise=${encodeURIComponent(id)}`);
  };

  const w = (kg: number) => pf.number(toDisplayWeight(kg, unit));

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
          {t("title")}
        </h1>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {exercise && <ExercisePicker exercises={exercises} value={exercise.id} onChange={selectExercise} />}
          <RangeControl value={range} onChange={setRange} />
        </div>
      </header>

      {exercise && summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          <StatCard label={t("stats.workingWeight")}>
            <StatValue value={summary.workingWeight && w(summary.workingWeight.value)} unit={unitText} />
            {summary.workingWeight?.delta != null && (
              <Delta
                value={summary.workingWeight.delta}
                text={`${pf.signed(toDisplayWeight(summary.workingWeight.delta, unit))} ${unitText}`}
              />
            )}
          </StatCard>
          <StatCard label={t("stats.e1rm")}>
            <StatValue value={summary.e1rm && w(summary.e1rm.value)} unit={unitText} />
            {summary.e1rm?.delta != null && (
              <Delta
                value={summary.e1rm.delta}
                text={`${pf.signed(toDisplayWeight(summary.e1rm.delta, unit))} ${unitText}`}
              />
            )}
          </StatCard>
          <StatCard label={t("stats.bestSet")}>
            {summary.bestSet ? (
              <p className="truncate font-heading text-2xl leading-none font-extrabold tracking-tight md:text-[26px]">
                {w(summary.bestSet.weight)}
                <span className="ml-1 hidden text-sm font-semibold text-muted-foreground sm:inline">{unitText}</span>
                <span className="mx-1 text-muted-foreground">×</span>
                {summary.bestSet.reps}
              </p>
            ) : (
              <StatValue value={null} unit={unitText} />
            )}
          </StatCard>
          <StatCard label={t("stats.sessions")}>
            <StatValue value={String(summary.sessions.length)} />
          </StatCard>
        </div>
      )}

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <Slot className="lg:col-start-1 lg:row-start-1">
          {exercise && summary ? (
            <ExerciseChart title={exerciseName(exercise, pf.locale)} sessions={summary.sessions} />
          ) : (
            <NoLiftsCard />
          )}
        </Slot>
        <Slot className="lg:col-start-1 lg:row-start-2">{volume}</Slot>
        <Slot className="lg:col-start-2 lg:row-start-1">{records}</Slot>
        <Slot className="lg:col-start-2 lg:row-start-2">
          <BodyWeightCard entries={bodyWeight} periodFrom={periodFrom} />
        </Slot>
      </div>
    </div>
  );
}

/** Комірка сітки: картка всередині розтягується на висоту рядка. */
function Slot({ className, children }: { className: string; children: ReactNode }) {
  return <div className={cn("flex min-w-0 flex-col *:flex-1", className)}>{children}</div>;
}

function ExercisePicker({
  exercises,
  value,
  onChange,
}: {
  exercises: ExerciseHistory[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("progress");
  const locale = useLocale();
  const current = exercises.find((e) => e.id === value);
  const currentName = current ? exerciseName(current, locale) : "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("exercisePicker", { name: currentName })}
          className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-full border border-foreground/10 bg-card px-4 text-[15px] font-semibold transition-colors hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none md:h-10 md:w-auto md:max-w-64"
        >
          {current && <ExerciseThumb exercise={{ muscleGroup: current.muscleGroup ?? "" }} size="sm" className="-ml-2.5 size-8 rounded-full" />}
          <span className="truncate">{currentName}</span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-(--radix-dropdown-menu-trigger-width) min-w-60 border-foreground/10 bg-card text-foreground"
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {exercises.map((e) => (
            <DropdownMenuRadioItem key={e.id} value={e.id} className="gap-2.5 py-2 text-sm">
              <ExerciseThumb exercise={{ muscleGroup: e.muscleGroup ?? "" }} size="sm" className="size-8 rounded-xl" />
              <span className="truncate">{exerciseName(e, locale)}</span>
              <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                {e.sessions.length}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RangeControl({ value, onChange }: { value: RangeKey; onChange: (key: RangeKey) => void }) {
  const t = useTranslations("progress");
  return (
    <div
      role="radiogroup"
      aria-label={t("range")}
      className="grid grid-cols-5 gap-1 rounded-full border border-foreground/10 bg-card p-1 md:flex"
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.key)}
            className={cn(
              "h-8 min-w-11 rounded-full px-3 text-xs font-bold transition-colors focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {t(`ranges.${r.key}`)}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-foreground/10 bg-card p-4 md:p-5">
      <p className="truncate text-xs text-muted-foreground md:text-sm">{label}</p>
      <div className="mt-2 flex flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-2.5">
        {children}
      </div>
    </div>
  );
}

function StatValue({ value, unit }: { value: string | null; unit?: string }) {
  return (
    <p className="truncate font-heading text-2xl leading-none font-extrabold tracking-tight md:text-[26px]">
      {value ?? "—"}
      {value && unit && <span className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</span>}
    </p>
  );
}

function NoLiftsCard() {
  const t = useTranslations("progress.noLifts");
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-accent-text">
        <ChartLine className="size-7" aria-hidden />
      </span>
      <p className="mt-4 font-heading text-lg font-bold">{t("title")}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("text")}</p>
      <Link
        href="/workouts"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        {t("cta")}
      </Link>
    </Card>
  );
}
