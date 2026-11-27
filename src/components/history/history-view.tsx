import Link from "next/link";
import { CalendarSearch, Dumbbell, History, Trophy, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toDayKey } from "@/lib/dates";
import { hasActiveFilters } from "@/lib/history/derive";
import type { HistoryPageData } from "@/lib/history/queries";
import { historyHref, type HistoryQuery } from "@/lib/history/url";
import { exerciseName } from "@/lib/i18n/names";
import { createWeightFormat, formatNumber, kgToUnit, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { ExportButton, HistoryMenu } from "./export-dialog";
import { shortDate, weekRange } from "./format";
import { HistoryCalendar } from "./history-calendar";
import { HistoryFilters } from "./history-filters";
import { WorkoutCard } from "./workout-card";
import { WorkoutsSwitch } from "./workouts-switch";

const pillLink =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98]";

/**
 * Сторінка історії. lg+: ліва колонка 320px (календар, підсумок місяця,
 * останні рекорди), праворуч фільтри і список по тижнях. Телефон:
 * смуга тижня, чипи підсумку, фільтри, картки.
 */
export function HistoryView({ data, query, unit }: { data: HistoryPageData; query: HistoryQuery; unit: WeightUnit }) {
  const t = useTranslations("history");
  const tw = useTranslations("workouts");
  const locale = useLocale();
  const filtersOn = hasActiveFilters(data.filters);
  const empty = data.weeks.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
          {tw("title")}
        </h1>
        <HistoryMenu month={query.month} className="ml-auto lg:hidden" />
        <WorkoutsSwitch active="history" className="max-lg:order-last max-lg:max-w-none" />
        <ExportButton month={query.month} className="ml-auto hidden lg:inline-flex" />
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="flex flex-col gap-4">
          <HistoryCalendar query={query} today={data.today} trainingDays={data.trainingDays} />
          <MonthSummaryCard data={data} unit={unit} className="hidden lg:block" />
          <MonthSummaryChips data={data} unit={unit} className="lg:hidden" />
          <RecordsCard data={data} unit={unit} className="hidden lg:flex" />
        </aside>

        <section aria-label={t("metaTitle")} className="flex min-w-0 flex-col gap-3.5">
          <HistoryFilters query={query} programs={data.options.programs} exercises={data.options.exercises} />

          {query.day && (
            <p className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("calendar.filtered", { date: shortDate(query.day, locale) })}</span>
              <Link
                href={historyHref({ ...query, day: null })}
                scroll={false}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-foreground/6 px-3 text-xs font-semibold hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
              >
                <X className="size-3.5" aria-hidden />
                {t("calendar.clearDay")}
              </Link>
            </p>
          )}

          {empty ? (
            <EmptyState data={data} query={query} filtersOn={filtersOn} />
          ) : (
            data.weeks.map((week) => (
              <section key={week.weekStart} aria-labelledby={`week-${week.weekStart}`} className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3 px-1 pt-1">
                  <h2
                    id={`week-${week.weekStart}`}
                    className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
                  >
                    {week.kind === "earlier" ? weekRange(week.weekStart, week.weekEnd, locale) : t(`weeks.${week.kind}`)}
                    {" · "}
                    {t("weeks.count", { count: week.workouts.length })}
                  </h2>
                  {week.kind !== "earlier" && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {weekRange(week.weekStart, week.weekEnd, locale)}
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-2.5">
                  {week.workouts.map((w) => (
                    <li key={w.id}>
                      <WorkoutCard workout={w} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {data.hasEarlier && (
            <Link
              href={historyHref({ ...query, more: query.more + 1 })}
              scroll={false}
              className={cn(pillLink, "mt-1 self-center border border-foreground/25 hover:bg-foreground/5")}
            >
              <History className="size-4" aria-hidden />
              {t("showPrevious")}
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

function MonthSummaryCard({ data, unit, className }: { data: HistoryPageData; unit: WeightUnit; className?: string }) {
  const t = useTranslations("history.summary");
  const locale = useLocale();
  const fmt = createWeightFormat(unit, locale);
  const items = [
    { value: formatNumber(data.summary.workouts, locale), label: t("workouts", { count: data.summary.workouts }) },
    {
      value: formatNumber(Math.round(kgToUnit(data.summary.volumeKg, unit)), locale),
      label: t("volume", { unit: fmt.unitLabel }),
    },
    { value: formatNumber(data.summary.records, locale), label: t("records", { count: data.summary.records }), accent: true },
  ];
  return (
    <section aria-labelledby="month-summary" className={cn("rounded-[20px] border border-foreground/10 bg-card px-5 py-4", className)}>
      <h2 id="month-summary" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {t("title")}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col-reverse">
            <dt className="mt-0.5 truncate text-xs text-muted-foreground">{item.label}</dt>
            <dd
              className={cn(
                "truncate font-heading text-[22px] leading-tight font-extrabold tabular-nums",
                item.accent && "text-accent-text",
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MonthSummaryChips({ data, unit, className }: { data: HistoryPageData; unit: WeightUnit; className?: string }) {
  const t = useTranslations("history.summary");
  const locale = useLocale();
  const volume = createWeightFormat(unit, locale).volume(data.summary.volumeKg);
  const chip = "inline-flex h-9 items-center rounded-full border border-foreground/10 bg-card px-3.5 text-[13px] font-semibold tabular-nums";
  return (
    <ul aria-label={t("title")} className={cn("flex flex-wrap gap-2", className)}>
      <li className={chip}>{t("workoutsChip", { count: data.summary.workouts })}</li>
      <li className={chip}>{t("volumeChip", { value: volume.value, unit: volume.unit })}</li>
      <li className={cn(chip, "border-primary/30 text-accent-text")}>{t("recordsChip", { count: data.summary.records })}</li>
    </ul>
  );
}

function RecordsCard({ data, unit, className }: { data: HistoryPageData; unit: WeightUnit; className?: string }) {
  const t = useTranslations("history.records");
  const locale = useLocale();
  const fmt = createWeightFormat(unit, locale);
  return (
    <section
      aria-labelledby="recent-records"
      className={cn("flex-col gap-3 rounded-[20px] border border-foreground/10 bg-card px-5 py-4", className)}
    >
      <h2 id="recent-records" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {t("title")}
      </h2>
      {data.records.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.records.map((r) => (
            <li key={`${r.workoutId}-${r.exerciseId}`}>
              <Link
                href={`/workouts/${r.workoutId}`}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-foreground/4 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-accent-text">
                  <Trophy className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] leading-snug font-medium">{exerciseName(r, locale)}</span>
                  <span className="block text-xs text-muted-foreground">{shortDate(toDayKey(r.startedAt), locale)}</span>
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                  {fmt.value(r.weight)} × {r.reps}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState({ data, query, filtersOn }: { data: HistoryPageData; query: HistoryQuery; filtersOn: boolean }) {
  const t = useTranslations("history.empty");
  const box = "flex flex-col items-center rounded-[20px] border border-dashed border-foreground/15 px-6 py-12 text-center";

  if (data.totalInRange > 0 && filtersOn) {
    return (
      <div className={box}>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-foreground/6 text-muted-foreground">
          <CalendarSearch className="size-6" aria-hidden />
        </span>
        <p className="mt-3 font-heading text-lg font-bold">{t("noResults")}</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("noResultsText")}</p>
        <Link
          href={historyHref({ month: query.month, more: query.more })}
          scroll={false}
          className={cn(pillLink, "mt-5 border border-foreground/25 hover:bg-foreground/5")}
        >
          {t("reset")}
        </Link>
      </div>
    );
  }

  if (data.hasEarlier) {
    return (
      <div className={box}>
        <p className="text-sm text-muted-foreground">{t("month")}</p>
      </div>
    );
  }

  return (
    <div className={box}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-accent-text">
        <Dumbbell className="size-6 rotate-45" aria-hidden />
      </span>
      <p className="mt-3 font-heading text-lg font-bold">{t("title")}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("text")}</p>
      <Link href="/workouts" className={cn(pillLink, "mt-5 h-12 bg-primary px-6 text-primary-foreground hover:bg-primary/90")}>
        {t("cta")}
      </Link>
    </div>
  );
}
