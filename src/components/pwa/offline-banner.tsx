"use client";

import { CloudUpload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOffline } from "@/lib/offline/offline-store";

/**
 * Дашборд: є тренування, завершене без мережі, — воно на пристрої й
 * піде на сервер, щойно з'явиться інтернет (OfflineSync у layout).
 */
export function OfflineQueueBanner() {
  const t = useTranslations("offline.banner");
  const finishes = useOffline((s) => s.finishes);
  if (finishes.length === 0) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-orange-400/40 bg-orange-400/5 p-4"
    >
      <CloudUpload className="mt-0.5 size-5 shrink-0 text-orange-300" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{t("title", { count: finishes.length })}</p>
        <p className="mt-0.5 text-foreground/70">{t("text")}</p>
      </div>
    </div>
  );
}
