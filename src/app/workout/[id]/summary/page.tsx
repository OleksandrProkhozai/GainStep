import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { SummaryView } from "@/components/summary/summary-view";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadWorkoutSummary } from "@/lib/workout/summary-queries";

export const metadata: Metadata = { title: "Workout summary · GainStep" };

/**
 * Підсумок завершеного тренування (і сторінка деталей тренування з історії).
 * Незавершене тренування → екран тренування; чуже або неіснуюче → 404.
 */
export default async function WorkoutSummaryPage({ params }: PageProps<"/workout/[id]/summary">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const result = await loadWorkoutSummary(supabase, id, user.id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "in-progress") redirect(`/workout/${id}`);

  return <SummaryView data={result.data} />;
}
