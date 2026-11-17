import { Play } from "lucide-react";
import { StartWorkoutButton } from "@/components/dashboard/start-workout-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { startWorkout } from "@/lib/workout/actions";
import type { HubDay } from "@/lib/workout/hub-queries";

export const BLOCKED_HINT = "Finish or discard the current workout first";

const startClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:opacity-70";

/** Картка дня програми з кнопкою старту (server action startWorkout). */
export function DayCard({ day, blocked }: { day: HubDay; blocked: boolean }) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5",
        day.isNext ? "border-primary/60" : "border-white/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate font-heading text-xl font-extrabold">{day.name}</h3>
        {day.isNext && (
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
            Up next
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground/80">
        {day.exerciseCount} {day.exerciseCount === 1 ? "exercise" : "exercises"}
      </p>
      <ul className="mt-2 mb-5 space-y-0.5 text-sm text-muted-foreground">
        {day.preview.map((name, i) => (
          <li key={`${name}-${i}`} className="truncate">
            {name}
          </li>
        ))}
        {day.exerciseCount > day.preview.length && (
          <li className="text-muted-foreground/70">+{day.exerciseCount - day.preview.length} more</li>
        )}
      </ul>

      <div className="mt-auto">
        {blocked ? (
          <TooltipProvider>
            <Tooltip>
              {/* Неактивна кнопка не отримує подій — тригер навколо неї */}
              <TooltipTrigger asChild>
                <span tabIndex={0} className="block rounded-full focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none">
                  <button
                    type="button"
                    disabled
                    className={cn(startClass, "pointer-events-none bg-white/10 text-muted-foreground")}
                  >
                    <Play className="size-4 fill-current" aria-hidden />
                    Start
                    <span className="sr-only"> — {BLOCKED_HINT}</span>
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{BLOCKED_HINT}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <form action={startWorkout.bind(null, day.id)}>
            <StartWorkoutButton label="Start" className={startClass} />
          </form>
        )}
      </div>
    </article>
  );
}
