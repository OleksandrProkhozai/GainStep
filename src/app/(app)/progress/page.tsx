import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ProgressView } from "@/components/progress/progress-view";
import { RecordsCard } from "@/components/progress/records-card";
import { WeeklyVolumeCard } from "@/components/progress/weekly-volume-card";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProgressData } from "@/lib/progress/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("progress");
  return { title: t("title") };
}

/**
 * Прогрес: динаміка вибраної вправи (робоча вага / оцінка 1ПМ),
 * особисті рекорди, тоннаж по тижнях і вага тіла.
 * Вправу можна задати в адресі: /progress?exercise=<id>.
 */
export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const now = new Date();
  const [data, params] = await Promise.all([getProgressData(supabase, user.id, now, locale), searchParams]);

  const requested = typeof params.exercise === "string" ? params.exercise : null;
  const initialExerciseId =
    data.exercises.find((e) => e.id === requested)?.id ?? data.exercises[0]?.id ?? null;

  return (
    <ProgressView
      exercises={data.exercises}
      initialExerciseId={initialExerciseId}
      now={now.getTime()}
      records={<RecordsCard records={data.records} unit={user.unit} now={now.getTime()} />}
      volume={<WeeklyVolumeCard weeks={data.weeklyVolume} />}
      bodyWeight={data.bodyWeight}
    />
  );
}
