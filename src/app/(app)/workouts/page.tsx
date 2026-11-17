import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, LayoutGrid } from "lucide-react";
import { ActiveWorkoutBanner } from "@/components/workouts/active-workout-banner";
import { BLOCKED_HINT, DayCard } from "@/components/workouts/day-card";
import { RecentWorkouts } from "@/components/workouts/recent-workouts";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutsHubData } from "@/lib/workout/hub-queries";

export const metadata: Metadata = { title: "Workouts · GainStep" };

/**
 * Хаб тренувань: незавершене тренування, старт будь-якого дня активної
 * програми та останні завершені тренування. Повна історія — Етап 8.
 */
export default async function WorkoutsPage() {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  const supabase = await createClient();
  const data = await getWorkoutsHubData(supabase, user.id);
  const blocked = data.active !== null;

  return (
    <div className="space-y-7 md:space-y-9">
      <header>
        <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
          Workouts
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Start a session or pick up where you left off.
        </p>
      </header>

      {data.active && <ActiveWorkoutBanner workout={data.active} />}

      <section aria-labelledby="start-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="start-heading" className="font-heading text-lg font-bold md:text-xl">
            Start a workout
          </h2>
          {data.program && <p className="text-sm text-muted-foreground">{data.program.name}</p>}
        </div>

        {data.program && data.program.days.length > 0 ? (
          <>
            {blocked && (
              <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="size-4 shrink-0" aria-hidden />
                {BLOCKED_HINT}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {data.program.days.map((day) => (
                <DayCard key={day.id} day={day} blocked={blocked} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-card px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <LayoutGrid className="size-6" aria-hidden />
            </span>
            <p className="mt-3 font-heading text-lg font-bold">No program yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Pick a training program to get your workout days.
            </p>
            <Link
              href="/programs"
              className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98]"
            >
              <LayoutGrid className="size-4" aria-hidden />
              Choose a program
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-3 font-heading text-lg font-bold md:text-xl">
          Recent workouts
        </h2>
        <RecentWorkouts workouts={data.recent} unit={data.unit} />
      </section>
    </div>
  );
}
