import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/settings-view";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

/** Налаштування: профіль, одиниці / тема / таймер, акаунт. Зберігаються автоматично. */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");

  return (
    <SettingsView
      initial={{
        displayName: user.displayName,
        email: user.email,
        experience: user.experience,
        goal: user.goal,
        unit: user.unit,
        minRestSeconds: user.minRestSeconds,
        transitionRestEnabled: user.transitionRestEnabled,
        locale: await getLocale(),
      }}
    />
  );
}
