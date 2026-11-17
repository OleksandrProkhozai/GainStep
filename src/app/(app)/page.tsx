import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, Dumbbell, Flame, Trophy } from "lucide-react";
import { ProgressionCard, StatCard, TodayCard } from "@/components/dashboard/cards";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";
import { USER_TIME_ZONE } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { formatVolume, toDisplayWeight } from "@/lib/units";

export const metadata: Metadata = { title: "Dashboard · GainStep" };

const todayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: USER_TIME_ZONE,
});

/**
 * Дашборд. Сторінка читає сесію, тож рендериться на запит;
 * поки дані вантажаться, показується скелетон із loading.tsx.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  const supabase = await createClient();
  const now = new Date();
  const data = await getDashboardData(supabase, user.id, now);

  const firstName =
    (data.displayName ?? user.displayName)?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "athlete";
  const volume = formatVolume(data.week.volumeKg, data.unit);
  const points =
    data.progress?.points.map((p) => ({
      t: new Date(p.date).getTime(),
      value: toDisplayWeight(p.oneRmKg, data.unit),
    })) ?? [];

  return (
    <div className="space-y-4 md:space-y-5">
      <header>
        <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
          Hi, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {todayFormat.format(now)}
          {data.program && <> · {data.program.name}</>}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <TodayCard
          day={data.program ? data.today : null}
          activeWorkout={data.activeWorkout}
        />
        <ProgressionCard />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        <StatCard
          icon={Dumbbell}
          iconClassName="rotate-45 text-primary"
          value={volume.value}
          suffix={volume.unit}
          label="Weekly volume"
        />
        <StatCard
          icon={CalendarDays}
          iconClassName="text-foreground/80"
          value={String(data.week.workouts)}
          label="Workouts this week"
        />
        <StatCard
          icon={Flame}
          iconClassName="text-orange-400"
          value={String(data.streakWeeks)}
          label="Week streak"
        />
        <StatCard
          icon={Trophy}
          iconClassName="text-yellow-400"
          value="—"
          label="New PRs · Coming soon"
        />
      </div>

      <ProgressChart
        exerciseName={data.progress?.exerciseName ?? null}
        unit={data.unit}
        points={points}
        now={now.getTime()}
      />
    </div>
  );
}
