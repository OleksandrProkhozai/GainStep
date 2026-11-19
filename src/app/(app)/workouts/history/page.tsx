import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { HistoryView } from "@/components/history/history-view";
import { getCurrentUser } from "@/lib/auth/session";
import { toDayKey } from "@/lib/dates";
import { monthOf } from "@/lib/history/month";
import { getHistoryPageData } from "@/lib/history/queries";
import { parseHistoryQuery } from "@/lib/history/url";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("history");
  return { title: t("metaTitle") };
}

/**
 * Історія тренувань: /workouts/history?month=2026-11&program=…&exercise=…&q=…&day=…&more=1.
 * Лише завершені тренування (status = 'completed'); активне показує
 * банер на /workouts.
 */
export default async function WorkoutHistoryPage({ searchParams }: PageProps<"/workouts/history">) {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  const [supabase, locale, params] = await Promise.all([createClient(), getLocale(), searchParams]);

  // getCurrentUser уже дочекався запиту (connection), тож поточна дата тут безпечна.
  const today = toDayKey(new Date());
  const query = parseHistoryQuery(params, monthOf(today));
  const data = await getHistoryPageData(
    supabase,
    user.id,
    {
      month: query.month,
      more: query.more,
      today,
      filters: { programId: query.program, exerciseId: query.exercise, q: query.q, day: query.day },
    },
    locale,
  );

  return <HistoryView data={data} query={query} unit={user.unit} />;
}
