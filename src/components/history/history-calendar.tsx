"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DayButtonProps } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { addDays, startOfWeek } from "@/lib/dates";
import { monthBounds, shiftMonth } from "@/lib/history/month";
import { historyHref, type HistoryQuery } from "@/lib/history/url";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { cn } from "@/lib/utils";
import { monthTitle } from "./format";

const toKey = (date: Date) => format(date, "yyyy-MM-dd");

const roundBtn =
  "flex size-9 items-center justify-center rounded-full border border-foreground/12 text-foreground/85 transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none";

/**
 * Календар історії. Дні з тренуваннями — лаймова крапка під числом,
 * сьогодні — лаймовий контур. Клік по дню з тренуванням фільтрує список
 * (?day=), повторний клік знімає фільтр. Стрілки змінюють ?month.
 * Телефон: згорнутий у смугу тижня; стрілка розгортає місяць.
 */
export function HistoryCalendar({
  query,
  today,
  trainingDays,
}: {
  query: HistoryQuery;
  today: string;
  trainingDays: string[];
}) {
  const t = useTranslations("history.calendar");
  const locale = useLocale();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const training = useMemo(() => new Set(trainingDays), [trainingDays]);

  const monthHref = (delta: number) => historyHref({ ...query, month: shiftMonth(query.month, delta), day: null, more: 0 });

  const toggleDay = (key: string) => {
    if (!training.has(key)) return;
    startTransition(() => {
      router.replace(historyHref({ ...query, day: query.day === key ? null : key }), { scroll: false });
    });
  };

  const header = (
    <div className="flex items-center justify-between gap-2 px-1">
      <h2 className="font-heading text-base font-bold" aria-live="polite">
        {monthTitle(query.month, locale)}
      </h2>
      <div className="flex items-center gap-1.5">
        <Link href={monthHref(-1)} scroll={false} aria-label={t("prev")} className={cn(roundBtn, "size-8")}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <Link href={monthHref(1)} scroll={false} aria-label={t("next")} className={cn(roundBtn, "size-8")}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? t("collapse") : t("expand")}
          className={cn(roundBtn, "size-8 lg:hidden")}
        >
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>
    </div>
  );

  return (
    <section
      aria-label={monthTitle(query.month, locale)}
      aria-busy={pending}
      className={cn("rounded-[20px] border border-foreground/10 bg-card px-3 pt-4 pb-3 transition-opacity", pending && "opacity-70")}
    >
      {header}
      <MonthGrid
        query={query}
        today={today}
        training={training}
        onDayClick={toggleDay}
        className={cn("mt-2", !expanded && "max-lg:hidden")}
      />
      {!expanded && (
        <WeekStrip query={query} today={today} training={training} onDayClick={toggleDay} className="mt-3 lg:hidden" />
      )}
    </section>
  );
}

function MonthGrid({
  query,
  today,
  training,
  onDayClick,
  className,
}: {
  query: HistoryQuery;
  today: string;
  training: ReadonlySet<string>;
  onDayClick: (key: string) => void;
  className?: string;
}) {
  const t = useTranslations("history.calendar");
  const locale = useLocale();
  const dfLocale = dateFnsLocale(locale);
  const month = parseISO(`${query.month}-01`);

  return (
    <Calendar
      className={cn("w-full bg-transparent p-0 [--cell-size:--spacing(9)]", className)}
      classNames={{
        root: "w-full",
        month_caption: "hidden",
        weekday: "flex-1 pb-1 text-[11px] font-semibold text-muted-foreground select-none",
        week: "mt-1 flex w-full",
        day: "flex flex-1 items-center justify-center p-0",
        today: "",
        outside: "",
        disabled: "",
      }}
      hideNavigation
      month={month}
      locale={dfLocale}
      weekStartsOn={1}
      today={parseISO(today)}
      onDayClick={(date) => onDayClick(toKey(date))}
      disabled={(date) => !training.has(toKey(date))}
      modifiers={{ training: (date) => training.has(toKey(date)), picked: (date) => toKey(date) === query.day }}
      labels={{
        labelDayButton: (date, modifiers) =>
          `${format(date, "PPPP", { locale: dfLocale })}${modifiers.training ? `, ${t("hasWorkout")}` : ""}`,
      }}
      components={{ DayButton: HistoryDayButton }}
    />
  );
}

/** Кнопка дня: крапка — тренування, контур — сьогодні, лайм — обраний день. */
function HistoryDayButton({ day, modifiers, className, children, ...props }: DayButtonProps) {
  void day;
  void className;
  return (
    <button
      {...props}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-full text-[13px] font-medium tabular-nums transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
        modifiers.outside ? "text-muted-foreground/55" : "text-foreground/90",
        modifiers.training && !modifiers.picked && "hover:bg-foreground/6",
        modifiers.disabled && "cursor-default",
        modifiers.today && "font-bold text-accent-text ring-[1.5px] ring-primary ring-inset",
        modifiers.picked && "bg-primary font-bold text-primary-foreground",
      )}
    >
      {children}
      {modifiers.training && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-[3px] size-1 rounded-full",
            modifiers.picked ? "bg-primary-foreground" : "bg-primary",
          )}
        />
      )}
    </button>
  );
}

/** Тиждень для смуги: обраного дня → сьогодні (якщо в місяці) → останнього дня з тренуванням → перший тиждень. */
function stripWeek(query: HistoryQuery, today: string, training: ReadonlySet<string>) {
  const { first, last } = monthBounds(query.month);
  if (query.day) return startOfWeek(query.day);
  if (today >= first && today <= last) return startOfWeek(today);
  const days = [...training].filter((d) => d >= first && d <= last).sort();
  if (days.length > 0) return startOfWeek(days[days.length - 1]);
  return startOfWeek(first);
}

function WeekStrip({
  query,
  today,
  training,
  onDayClick,
  className,
}: {
  query: HistoryQuery;
  today: string;
  training: ReadonlySet<string>;
  onDayClick: (key: string) => void;
  className?: string;
}) {
  const t = useTranslations("history.calendar");
  const locale = useLocale();
  const dfLocale = dateFnsLocale(locale);
  const monday = stripWeek(query, today, training);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <ul className={cn("grid grid-cols-7", className)}>
      {days.map((key) => {
        const date = parseISO(key);
        const has = training.has(key);
        const isToday = key === today;
        const selected = query.day === key;
        return (
          <li key={key} className="flex flex-col items-center gap-1">
            <span aria-hidden className="text-[11px] font-semibold text-muted-foreground">
              {format(date, "EEEEEE", { locale: dfLocale })}
            </span>
            <button
              type="button"
              disabled={!has}
              onClick={() => onDayClick(key)}
              aria-pressed={has ? selected : undefined}
              aria-label={`${format(date, "PPPP", { locale: dfLocale })}${has ? `, ${t("hasWorkout")}` : ""}`}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-full text-sm font-medium tabular-nums transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
                !key.startsWith(query.month) && "text-muted-foreground/55",
                isToday && "font-bold text-accent-text ring-[1.5px] ring-primary ring-inset",
                selected && "bg-primary font-bold text-primary-foreground",
              )}
            >
              {format(date, "d")}
              {has && (
                <span
                  aria-hidden
                  className={cn("absolute bottom-1 size-1 rounded-full", selected ? "bg-primary-foreground" : "bg-primary")}
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
