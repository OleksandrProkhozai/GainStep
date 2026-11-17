import { format, parseISO } from "date-fns";
import { Dumbbell } from "lucide-react";
import { toDayKey } from "@/lib/dates";
import { formatVolume, type WeightUnit } from "@/lib/units";
import type { HubRecent } from "@/lib/workout/hub-queries";

/**
 * "Mon, 17 Nov" — дата в поясі користувача. Спершу беремо календарний
 * день у Europe/Kiev, потім форматуємо його date-fns (parseISO від
 * "YYYY-MM-DD" дає локальну північ, тож пояс сервера не зсуває дату).
 */
function formatDay(iso: string) {
  return format(parseISO(toDayKey(iso)), "EEE, d MMM");
}

/** "48 min" / "1 h 05 min"; без finished_at — "—". */
function formatDuration(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) return "—";
  const minutes = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** Останні завершені тренування (повна історія — Етап 8). */
export function RecentWorkouts({ workouts, unit }: { workouts: HubRecent[]; unit: WeightUnit }) {
  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-card px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Dumbbell className="size-6 rotate-45" aria-hidden />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">No workouts yet — start your first one above</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.6fr)] gap-4 border-b border-white/5 px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid"
      >
        <span>Workout</span>
        <span>Date</span>
        <span>Duration</span>
        <span className="text-right">Volume</span>
        <span className="text-right">Sets</span>
      </div>
      <ul className="divide-y divide-white/5">
        {workouts.map((w) => {
          const volume = formatVolume(w.volumeKg, unit);
          const date = formatDay(w.startedAt);
          const duration = formatDuration(w.startedAt, w.finishedAt);
          return (
            <li key={w.id}>
              {/* Телефон: два рядки */}
              <div className="flex items-center gap-3 px-4 py-3.5 md:hidden">
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
                    {w.setsDone} {w.setsDone === 1 ? "set" : "sets"}
                  </p>
                </div>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
