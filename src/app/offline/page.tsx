import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OfflineView } from "@/components/pwa/offline-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline.page");
  return { title: t("metaTitle") };
}

/**
 * Офлайн-фолбек. Service worker кладе цю сторінку в кеш при встановленні
 * й віддає її, коли сторінки немає ні в мережі, ні в кеші. Сторінка не
 * читає сесію (доступна без входу) — усе потрібне береться з пристрою.
 */
export default function OfflinePage() {
  return <OfflineView />;
}
