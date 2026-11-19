import type { Metadata } from "next";
import { Play } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workouts");
  return { title: t("newWorkout") };
}

export default async function Page() {
  const t = await getTranslations("workouts");
  return <ComingSoon title={t("newWorkout")} icon={Play} />;
}
