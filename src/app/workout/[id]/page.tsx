import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { WorkoutScreen } from "@/components/workout/workout-screen";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadWorkout } from "@/lib/workout/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workout");
  return { title: t("metaTitle") };
}

/**
 * Екран активного тренування. Сервер завантажує тренування, вправи дня,
 * історію завершених тренувань (одним запитом) і одиниці користувача;
 * далі все працює на клієнті (WorkoutScreen).
 */
export default async function WorkoutPage({ params }: PageProps<"/workout/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  if (!z.guid().safeParse(id).success) notFound();

  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const result = await loadWorkout(supabase, id, user.id, locale);
  if (result.kind === "not-found") notFound();
  if (result.kind === "completed") redirect(`/workout/${id}/summary`);

  return <WorkoutScreen init={result.data} />;
}
