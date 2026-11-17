import Image from "next/image";
import Link from "next/link";
import { LayoutGrid, Play, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { startWorkout } from "@/lib/workout/actions";
import { StartWorkoutButton } from "./start-workout-button";

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
  return (
    <section className="relative isolate flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card p-5 md:min-h-[200px] md:p-7">
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
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            In progress
          </p>
          <h2 className="mt-1.5 font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-[28px]">
            {activeWorkout.name}
          </h2>
          <p className="mt-1 mb-6 text-sm text-white/65 md:mb-0">Pick up where you left off.</p>
          <Link
            href={`/workout/${activeWorkout.id}`}
            className={cn(pillClass, "mt-auto w-full md:mt-6 md:w-fit")}
          >
            <Play className="size-4 fill-current" aria-hidden />
            Continue workout
          </Link>
        </>
      ) : day ? (
        <>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Next up
          </p>
          <h2 className="mt-1.5 font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-[28px]">
            Today: {day.name}
          </h2>
          <p className="mt-1 mb-6 text-sm text-white/65 md:mb-0">Let&apos;s crush your workout!</p>
          {/* Старт — server action (а не посилання): GET-запит, зокрема
              prefetch, не повинен створювати тренування. */}
          <form action={startWorkout.bind(null, day.id)} className="mt-auto md:mt-6">
            <StartWorkoutButton className={cn(pillClass, "w-full disabled:opacity-70 md:w-fit")} />
          </form>
        </>
      ) : (
        <>
          <h2 className="font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-[28px]">
            No program yet
          </h2>
          <p className="mt-1 mb-6 max-w-xs text-sm text-white/65 md:mb-0">
            Pick a training program to get your daily workout plan.
          </p>
          <Link
            href="/programs"
            className={cn(pillClass, "mt-auto w-full md:mt-6 md:w-fit")}
          >
            <LayoutGrid className="size-4" aria-hidden />
            Choose a program
          </Link>
        </>
      )}
    </section>
  );
}

/** "Smart progression": поки алгоритму немає — порожній стан. */
export function ProgressionCard() {
  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-card p-5">
      <h2 className="font-heading text-base font-bold">Smart progression</h2>
      <div className="mt-3 flex flex-1 items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4 md:flex-col md:items-start md:justify-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">
          Complete a workout to get weight recommendations
        </p>
      </div>
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
    <div className="min-w-0 rounded-2xl border border-white/10 bg-card p-4 md:p-5">
      <Icon className={cn("size-6", iconClassName)} aria-hidden />
      <p className="mt-3 truncate font-heading text-2xl leading-none font-extrabold tracking-tight md:text-[28px]">
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-semibold text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
      <p className="mt-1.5 truncate text-xs text-muted-foreground md:text-sm">
        {label}
      </p>
    </div>
  );
}
