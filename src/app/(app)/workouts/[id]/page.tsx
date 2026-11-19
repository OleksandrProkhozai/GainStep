import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { WorkoutDetail } from "@/components/history/workout-detail";
import { getCurrentUser } from "@/lib/auth/session";
import { loadHistoryWorkout } from "@/lib/history/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("history.detail");
  return { title: t("metaTitle") };
}

/**
 * Завершене тренування з історії. Незавершене → екран тренування;
 * чуже або неіснуюче → 404 (RLS + перевірка user_id).
 */
export default async function WorkoutDetailPage({ params }: PageProps<"/workouts/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  if (!z.guid().safeParse(id).success) notFound();

  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const result = await loadHistoryWorkout(supabase, user.id, id, locale);
  if (result.kind === "not-found") notFound();
  if (result.kind === "in-progress") redirect(`/workout/${id}`);

  return <WorkoutDetail workout={result.workout} unit={user.unit} />;
}
