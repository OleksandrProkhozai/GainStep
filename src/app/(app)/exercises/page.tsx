import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ExerciseLibrary } from "@/components/exercises/exercise-library";
import { SectionSwitch } from "@/components/programs/section-switch";
import { getCurrentUser } from "@/lib/auth/session";
import { getExerciseLibrary } from "@/lib/programs/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("exercises");
  return { title: t("title") };
}

/** Бібліотека вправ: системні + власні. Пошук і фільтри — у search params. */
export default async function ExercisesPage() {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  const supabase = await createClient();
  const exercises = await getExerciseLibrary(supabase);

  return (
    <div className="space-y-5">
      <header className="space-y-4">
        <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
          {(await getTranslations("exercises"))("title")}
        </h1>
        <SectionSwitch active="exercises" />
      </header>
      <ExerciseLibrary exercises={exercises} />
    </div>
  );
}
