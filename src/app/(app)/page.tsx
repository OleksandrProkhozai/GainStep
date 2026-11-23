import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, Dumbbell, Flame, Trophy } from "lucide-react";
import { ProgressionCard, StatCard, TodayCard } from "@/components/dashboard/cards";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { OfflineQueueBanner } from "@/components/pwa/offline-banner";
import { OfflineKitSync } from "@/components/pwa/offline-kit-sync";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";
import { dateFormat } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { formatVolume } from "@/lib/units";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("metaTitle") };
}


/**
 * Дашборд. Сторінка читає сесію, тож рендериться на запит;
 * поки дані вантажаться, показується скелетон із loading.tsx.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  const [supabase, locale, t] = await Promise.all([createClient(), getLocale(), getTranslations("dashboard")]);
  const now = new Date();
  const data = await getDashboardData(supabase, user.id, now, locale);
  const todayFormat = dateFormat(locale, { weekday: "long", day: "numeric", month: "long" });

  const firstName =
    user.displayName?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    t("athlete");
  const unit = user.unit;
  const volume = formatVolume(data.week.volumeKg, unit, locale);
  const points =
    data.progress?.points.map((p) => ({ t: new Date(p.date).getTime(), valueKg: p.oneRmKg })) ?? [];

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Без мережі: тренування в черзі + кеш програми для офлайн-старту */}
      <OfflineQueueBanner />
      <OfflineKitSync />
      <header>
        <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
          {t.rich("greeting", {
            name: firstName,
            accent: (chunks) => <span className="text-accent-text">{chunks}</span>,
          })}
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
        <ProgressionCard items={data.program ? data.smartProgression : []} unit={unit} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        <StatCard
          icon={Dumbbell}
          iconClassName="rotate-45 text-accent-text"
          value={volume.value}
          suffix={volume.unit}
          label={t("stats.volume")}
        />
        <StatCard
          icon={CalendarDays}
          iconClassName="text-foreground/80"
          value={String(data.week.workouts)}
          label={t("stats.workouts")}
        />
        <StatCard
          icon={Flame}
          iconClassName="text-orange-400"
          value={String(data.streakWeeks)}
          label={t("stats.streak")}
        />
        <StatCard
          icon={Trophy}
          iconClassName="text-yellow-400"
          value={String(data.week.prs)}
          label={t("stats.prs")}
        />
      </div>

      <ProgressChart
        exerciseName={data.progress?.exerciseName ?? null}
        points={points}
        now={now.getTime()}
      />
    </div>
  );
}
