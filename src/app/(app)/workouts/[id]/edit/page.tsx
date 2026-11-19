import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { WorkoutEditForm } from "@/components/history/workout-edit-form";
import { getCurrentUser } from "@/lib/auth/session";
import { toDayKey } from "@/lib/dates";
import { loadHistoryWorkout } from "@/lib/history/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("history.edit");
  return { title: t("metaTitle") };
}

/** Редагування завершеного тренування. */
export default async function WorkoutEditPage({ params }: PageProps<"/workouts/[id]/edit">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  if (!z.guid().safeParse(id).success) notFound();

  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const result = await loadHistoryWorkout(supabase, user.id, id, locale);
  if (result.kind === "not-found") notFound();
  if (result.kind === "in-progress") redirect(`/workout/${id}`);

  // key — свіжа чернетка після кожного збереження.
  return (
    <WorkoutEditForm
      key={`${result.workout.id}-${result.workout.startedAt}`}
      workout={result.workout}
      today={toDayKey(new Date())}
    />
  );
}
