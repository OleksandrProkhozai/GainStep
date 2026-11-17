import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { WorkoutScreen } from "@/components/workout/workout-screen";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadWorkout } from "@/lib/workout/queries";

export const metadata: Metadata = { title: "Workout · GainStep" };

/**
 * Екран активного тренування. Сервер завантажує тренування, вправи дня,
 * історію завершених тренувань (одним запитом) і одиниці користувача;
 * далі все працює на клієнті (WorkoutScreen).
 */
export default async function WorkoutPage({ params }: PageProps<"/workout/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const result = await loadWorkout(supabase, id, user.id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "completed") redirect("/");

  return <WorkoutScreen init={result.data} />;
}
