import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { StartWorkoutButton } from "@/components/dashboard/start-workout-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { StartWorkoutForm } from "@/components/workout/start-workout-form";
import type { HubDay } from "@/lib/workout/hub-queries";

const startClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:opacity-70";

/** Картка дня програми з кнопкою старту (server action startWorkout). */
export function DayCard({ day, blocked }: { day: HubDay; blocked: boolean }) {
  const t = useTranslations("workouts");
  const hint = t("blocked");
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5",
        day.isNext ? "border-primary/60" : "border-foreground/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 font-heading text-xl leading-tight font-extrabold [overflow-wrap:anywhere]">{day.name}</h3>
        {day.isNext && (
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
            {t("upNext")}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground/80">
        {t("exerciseCount", { count: day.exerciseCount })}
      </p>
      <ul className="mt-2 mb-5 space-y-0.5 text-sm text-muted-foreground">
        {day.preview.map((name, i) => (
          <li key={`${name}-${i}`} className="line-clamp-2">
            {name}
          </li>
        ))}
        {day.exerciseCount > day.preview.length && (
          <li className="text-muted-foreground/70">{t("more", { count: day.exerciseCount - day.preview.length })}</li>
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
                    className={cn(startClass, "pointer-events-none bg-foreground/10 text-muted-foreground")}
                  >
                    <Play className="size-4 fill-current" aria-hidden />
                    {t("startShort")}
                    <span className="sr-only"> — {hint}</span>
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <StartWorkoutForm dayId={day.id}>
            <StartWorkoutButton label={t("startShort")} className={startClass} />
          </StartWorkoutForm>
        )}
      </div>
    </article>
  );
}
