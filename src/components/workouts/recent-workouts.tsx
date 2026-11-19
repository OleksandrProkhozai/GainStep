import Link from "next/link";
import { format, parseISO } from "date-fns";
import { enGB, uk } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Dumbbell } from "lucide-react";
import { formatMinutes, toDayKey } from "@/lib/dates";
import { createWeightFormat, type WeightUnit } from "@/lib/units";
import type { HubRecent } from "@/lib/workout/hub-queries";
import { workoutDurationMinutes } from "@/lib/workout/summary";

/**
 * "Mon, 17 Nov" — дата в поясі користувача. Спершу беремо календарний
 * день у Europe/Kiev, потім форматуємо його date-fns (parseISO від
 * "YYYY-MM-DD" дає локальну північ, тож пояс сервера не зсуває дату).
 */
function formatDay(iso: string, locale: string) {
  return format(parseISO(toDayKey(iso)), locale === "uk" ? "EEEEEE, d MMM" : "EEE, d MMM", {
    locale: locale === "uk" ? uk : enGB,
  });
}

/** "48 min" / "1h 05m" (uk: "1 год 05 хв"); без finished_at — "—". */
function formatDuration(startedAt: string, finishedAt: string | null, locale: string) {
  const minutes = workoutDurationMinutes(startedAt, finishedAt);
  return minutes === null ? "—" : formatMinutes(minutes, locale);
}

/** Останні завершені тренування (повна історія — Етап 8). */
export function RecentWorkouts({ workouts, unit }: { workouts: HubRecent[]; unit: WeightUnit }) {
  const t = useTranslations("workouts.recentList");
  const locale = useLocale();
  const fmt = createWeightFormat(unit, locale);
  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-foreground/10 bg-card px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-accent-text">
          <Dumbbell className="size-6 rotate-45" aria-hidden />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-card">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.6fr)] gap-4 border-b border-foreground/5 px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid"
      >
        <span>{t("workout")}</span>
        <span>{t("date")}</span>
        <span>{t("duration")}</span>
        <span className="text-right">{t("volume")}</span>
        <span className="text-right">{t("sets")}</span>
      </div>
      <ul className="divide-y divide-foreground/5">
        {workouts.map((w) => {
          const volume = fmt.volume(w.volumeKg);
          const date = formatDay(w.startedAt, locale);
          const duration = formatDuration(w.startedAt, w.finishedAt, locale);
          return (
            <li key={w.id}>
              <Link
                href={`/workout/${w.id}/summary`}
                className="block transition-colors hover:bg-foreground/3 focus-visible:bg-foreground/4 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none focus-visible:ring-inset active:bg-foreground/5"
              >
                {/* Телефон: два рядки */}
                <div className="flex items-center gap-3 py-3.5 pr-2.5 pl-4 md:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{w.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {date} · {duration}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {volume.value}
                      <span className="ml-0.5 text-xs font-medium text-muted-foreground">{volume.unit}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("setsCount", { count: w.setsDone })}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </div>
                {/* md+: таблиця */}
                <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.6fr)] items-center gap-4 px-5 py-3.5 text-sm md:grid">
                  <span className="truncate text-[15px] font-semibold">{w.name}</span>
                  <span className="text-muted-foreground">{date}</span>
                  <span className="text-muted-foreground tabular-nums">{duration}</span>
                  <span className="text-right font-semibold tabular-nums">
                    {volume.value}
                    <span className="ml-0.5 text-xs font-medium text-muted-foreground">{volume.unit}</span>
                  </span>
                  <span className="text-right tabular-nums">{w.setsDone}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
