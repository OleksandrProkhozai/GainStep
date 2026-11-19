"use client";

import { useTranslations } from "next-intl";
import { useWeightFormat } from "@/components/i18n/use-format";
import { useMinRest } from "@/components/preferences/preferences-provider";
import { cn } from "@/lib/utils";
import { effectiveRest } from "@/lib/workout/rest";
import { useWorkout } from "./context";
import { formatRest, useNow } from "./hooks";
import { useCurrentExercise, useNextSet } from "./use-workout-view";

/** Стан відпочинку для відображення: залишок, частка, пауза. */
function useRest() {
  const rest = useWorkout((s) => s.rest);
  const running = rest.endsAt !== null;
  const now = useNow(250, running);
  const remaining = running ? Math.max(0, rest.endsAt! - now) : (rest.pausedRemaining ?? 0);
  const active = running || rest.pausedRemaining !== null;
  return {
    active,
    paused: !running && rest.pausedRemaining !== null,
    remaining,
    fraction: active && rest.duration > 0 ? remaining / rest.duration : 0,
  };
}

function useNextLabel() {
  const t = useTranslations("workout.rest");
  const fmt = useWeightFormat();
  const next = useNextSet();
  if (!next) return t("allDone");
  const w = next.set.weightKg === null ? "—" : `${fmt.value(next.set.weightKg)} ${fmt.unitLabel}`;
  return t("next", { n: next.set.setNumber, weight: w, reps: next.set.reps });
}

/** SVG-кільце: сіра доріжка + лаймова дуга залишку (за годинниковою стрілкою від 12). */
function RestRing({
  fraction,
  size,
  stroke,
  children,
}: {
  fraction: number;
  size: number;
  stroke: number;
  children: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/12" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, fraction)))}
          className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function RestButtons({ disabled, size }: { disabled: boolean; size: "sm" | "md" }) {
  const t = useTranslations("workout.rest");
  const adjust = useWorkout((s) => s.adjustRest);
  const stop = useWorkout((s) => s.stopRest);
  const cls = cn(
    "rounded-full border border-foreground/15 font-semibold text-foreground/90 transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-95 disabled:pointer-events-none disabled:opacity-40",
    size === "md" ? "h-11 flex-1 text-sm" : "h-9 px-3 text-xs",
  );
  return (
    <>
      <button type="button" className={cls} disabled={disabled} onClick={() => adjust(-15, Date.now())}>
        −15s
      </button>
      <button type="button" className={cls} disabled={disabled} onClick={() => adjust(15, Date.now())}>
        +15s
      </button>
      <button type="button" className={cls} disabled={disabled} onClick={stop}>
        {t("skip")}
      </button>
    </>
  );
}

/** Десктоп: картка "Rest timer" з великим кільцем. Тап по кільцю — пауза. */
export function RestCard() {
  const { active, paused, remaining, fraction } = useRest();
  const toggle = useWorkout((s) => s.toggleRestPause);
  const t = useTranslations("workout.rest");
  const nextLabel = useNextLabel();
  const current = useCurrentExercise();
  const minRest = useMinRest();
  // Поки таймер не йде — відпочинок поточної вправи з урахуванням мінімуму.
  const idleText = formatRest(current ? effectiveRest(current.exercise.restSeconds, minRest) * 1000 : 0);

  return (
    <section className="rounded-2xl border border-foreground/10 bg-card p-5">
      <h2 className="font-heading text-lg font-bold">{t("title")}</h2>
      <div className="mt-4 flex flex-col items-center">
        <button
          type="button"
          onClick={() => toggle(Date.now())}
          disabled={!active}
          aria-label={paused ? t("resume") : t("pause")}
          className="rounded-full focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-default"
        >
          <RestRing fraction={fraction} size={172} stroke={14}>
            <span
              className={cn(
                "font-heading text-[44px] font-extrabold tabular-nums",
                !active && "text-foreground/35",
                paused && "animate-pulse",
              )}
            >
              {active ? formatRest(remaining) : idleText}
            </span>
          </RestRing>
        </button>
        <p className="mt-3 font-semibold">{paused ? t("paused") : t("restTime")}</p>
        <p className="mt-0.5 text-center text-sm text-muted-foreground">
          {active ? nextLabel : t("idle")}
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <RestButtons disabled={!active} size="md" />
      </div>
    </section>
  );
}

/** Телефон: компактна панель над нижнім краєм, видима лише під час відпочинку. */
export function RestBar() {
  const t = useTranslations("workout.rest");
  const { active, paused, remaining, fraction } = useRest();
  const toggle = useWorkout((s) => s.toggleRestPause);
  const nextLabel = useNextLabel();
  if (!active) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-card/95 pt-3 pr-[calc(env(safe-area-inset-right)+1rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pl-[calc(env(safe-area-inset-left)+1rem)] shadow-[0_-12px_32px_rgb(0_0_0/0.45)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <button
          type="button"
          onClick={() => toggle(Date.now())}
          aria-label={paused ? t("resume") : t("pause")}
          className="rounded-full focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <RestRing fraction={fraction} size={60} stroke={5}>
            <span className={cn("text-base font-bold tabular-nums", paused && "animate-pulse")}>
              {formatRest(remaining)}
            </span>
          </RestRing>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{paused ? t("paused") : t("restTime")}</p>
          <p className="truncate text-xs text-muted-foreground">{nextLabel}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <RestButtons disabled={false} size="sm" />
        </div>
      </div>
    </div>
  );
}

/** Чи йде відпочинок (для відступу контенту на телефоні). */
export function useRestActive() {
  const rest = useWorkout((s) => s.rest);
  return rest.endsAt !== null || rest.pausedRemaining !== null;
}
