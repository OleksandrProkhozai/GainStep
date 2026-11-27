import Image from "next/image";
import Link from "next/link";
import { LayoutGrid, Play, Sparkles, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { SmartSuggestion } from "@/lib/dashboard/queries";
import type { Suggestion, SuggestionAction } from "@/lib/progression";
import { createWeightFormat, type WeightFormat, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { StartWorkoutForm } from "@/components/workout/start-workout-form";
import { suggestionReason } from "@/lib/workout/suggestion-text";
import { StartWorkoutButton } from "./start-workout-button";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";

const pillClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98]";

/**
 * Картка "Today".
 * Телефон: фото на весь фон із затемненням, кнопка на всю ширину внизу.
 * md+: текст ліворуч, ч/б фото праворуч із градієнтом зліва.
 */
export function TodayCard({
  day,
  activeWorkout,
}: {
  day: { id: string; name: string } | null;
  /** Незавершене тренування — пропонуємо продовжити його. */
  activeWorkout: { id: string; name: string } | null;
}) {
  const t = useTranslations("dashboard.today");
  return (
    <section className="relative isolate flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card p-5 md:min-h-[200px] md:p-7">
      <div className="absolute inset-0 -z-10 md:left-[38%]">
        <Image
          src="/images/login-hero.jpg"
          alt=""
          fill
          sizes="(min-width: 768px) 40vw, 100vw"
          className="object-cover object-[72%_center] grayscale brightness-90 contrast-110"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-card via-card/80 to-card/40 md:bg-linear-to-r md:from-card md:via-card/45 md:to-transparent"
        />
      </div>

      {activeWorkout ? (
        <>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-text uppercase">
            {t("inProgress")}
          </p>
          <h2 className="mt-1.5 font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-[28px]">
            {activeWorkout.name}
          </h2>
          <p className="mt-1 mb-6 text-sm text-foreground/65 md:mb-0">{t("resumeText")}</p>
          <Link
            href={`/workout/${activeWorkout.id}`}
            className={cn(pillClass, "mt-auto w-full md:mt-6 md:w-fit")}
          >
            <Play className="size-4 fill-current" aria-hidden />
            {t("continue")}
          </Link>
        </>
      ) : day ? (
        <>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-text uppercase">
            {t("nextUp")}
          </p>
          <h2 className="mt-1.5 font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-[28px]">
            {t("todayDay", { name: day.name })}
          </h2>
          <p className="mt-1 mb-6 text-sm text-foreground/65 md:mb-0">{t("motivation")}</p>
          {/* Старт — server action (а не посилання): GET-запит, зокрема
              prefetch, не повинен створювати тренування. */}
          <StartWorkoutForm dayId={day.id} className="mt-auto md:mt-6">
            <StartWorkoutButton className={cn(pillClass, "w-full disabled:opacity-70 md:w-fit")} />
          </StartWorkoutForm>
        </>
      ) : (
        <>
          <h2 className="font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-[28px]">
            {t("noProgram")}
          </h2>
          <p className="mt-1 mb-6 max-w-xs text-sm text-foreground/65 md:mb-0">
            {t("noProgramText")}
          </p>
          <Link
            href="/programs"
            className={cn(pillClass, "mt-auto w-full md:mt-6 md:w-fit")}
          >
            <LayoutGrid className="size-4" aria-hidden />
            {t("chooseProgram")}
          </Link>
        </>
      )}
    </section>
  );
}

/** Скільки вправ показуємо в "Smart progression": одну великою + до двох у списку. */
const SMART_SHOWN = 3;

const ACTION_TONE: Record<Exclude<SuggestionAction, "none">, string> = {
  increase: "bg-primary text-primary-foreground",
  same: "bg-foreground/10 text-foreground/85",
  deload: "bg-orange-400 text-[#1a0f00]",
};

const ACTION_SIGN: Record<Exclude<SuggestionAction, "none">, { sign: string; className: string }> = {
  increase: { sign: "↑", className: "text-accent-text" },
  same: { sign: "=", className: "text-muted-foreground" },
  deload: { sign: "↓", className: "text-orange-400" },
};

function SuggestionPill({ suggestion, fmt }: { suggestion: Suggestion; fmt: WeightFormat }) {
  const t = useTranslations("dashboard.progression");
  if (suggestion.action === "none") return null;
  const text =
    suggestion.action === "increase"
      ? `↑ +${fmt.weight(suggestion.delta)}`
      : suggestion.action === "deload"
        ? "↓ −10%"
        : `= ${t("same")}`;
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap",
        ACTION_TONE[suggestion.action],
      )}
    >
      {text}
    </span>
  );
}

/**
 * "Smart progression": рекомендації алгоритму на сьогоднішній день програми.
 * Перша вправа — великим шрифтом з пігулкою і поясненням, ще до двох —
 * компактним списком. Порожній стан — якщо для жодної вправи немає історії.
 */
export function ProgressionCard({ items, unit }: { items: SmartSuggestion[]; unit: WeightUnit }) {
  const t = useTranslations("dashboard.progression");
  const tr = useTranslations("common.suggestion.reason");
  const fmt = createWeightFormat(unit, useLocale());
  const [first, ...rest] = items;
  const shown = rest.slice(0, SMART_SHOWN - 1);
  const more = items.length - 1 - shown.length;

  return (
    <section
      aria-labelledby="smart-progression-heading"
      className="flex min-w-0 flex-col rounded-2xl border border-foreground/10 bg-card p-5"
    >
      <h2 id="smart-progression-heading" className="flex items-center gap-2 font-heading text-base font-bold">
        <Sparkles className="size-4 text-amber-300" aria-hidden />
        {t("title")}
      </h2>
      {!first ? (
        <div className="mt-3 flex flex-1 items-center gap-3 rounded-xl border border-foreground/5 bg-foreground/[0.03] p-4 md:flex-col md:items-start md:justify-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-accent-text">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">
            {t("empty")}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3">
            <p className="flex items-center gap-2.5 text-sm text-foreground/85">
              <ExerciseThumb exercise={{ muscleGroup: first.muscleGroup ?? "" }} size="sm" />
              <span className="line-clamp-2 min-w-0">{first.name}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="font-heading text-[28px] leading-none font-extrabold tracking-tight tabular-nums">
                {fmt.weight(first.suggestion.weight ?? 0)}
              </p>
              <SuggestionPill suggestion={first.suggestion} fmt={fmt} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {(() => {
                const r = suggestionReason(first.suggestion, first);
                return tr(r.key, r.values);
              })()}
            </p>
          </div>
          {shown.length > 0 && (
            <ul className="mt-3 divide-y divide-foreground/5 border-t border-foreground/5">
              {shown.map((item) => {
                const sign = ACTION_SIGN[item.suggestion.action as Exclude<SuggestionAction, "none">];
                return (
                  <li key={item.exerciseId} className="flex items-center gap-2 py-2 text-sm">
                    <ExerciseThumb exercise={{ muscleGroup: item.muscleGroup ?? "" }} size="sm" className="size-7 rounded-xl" />
                    <span className="line-clamp-2 min-w-0 flex-1">{item.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {fmt.weight(item.suggestion.weight ?? 0)}
                    </span>
                    <span className={cn("w-3 shrink-0 text-center text-xs font-bold", sign.className)}>
                      <span aria-hidden>{sign.sign}</span>
                      <span className="sr-only">{t(`action.${item.suggestion.action as Exclude<SuggestionAction, "none">}`)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {more > 0 && <p className="mt-1 text-xs text-muted-foreground">{t("more", { count: more })}</p>}
        </>
      )}
    </section>
  );
}

export function StatCard({
  icon: Icon,
  iconClassName,
  value,
  suffix,
  label,
}: {
  icon: LucideIcon;
  iconClassName: string;
  value: string;
  suffix?: string;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-foreground/10 bg-card p-4 md:p-5">
      <Icon className={cn("size-6", iconClassName)} aria-hidden />
      <p className="mt-3 truncate font-heading text-2xl leading-none font-extrabold tracking-tight md:text-[28px]">
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-semibold text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
      <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground md:text-sm">
        {label}
      </p>
    </div>
  );
}
