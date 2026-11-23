"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { flushFinishQueue } from "@/lib/offline/flush";

/** Періодична повторна спроба, поки в черзі є завершені без мережі тренування. */
const RETRY_MS = 30_000;

/**
 * Фонова відправка черги завершень (кореневий layout — працює на будь-якій
 * сторінці): при старті, на подію 'online', при поверненні на вкладку і
 * періодично. Підходи тренування відправляються перед finishWorkout.
 */
export function OfflineSync() {
  const t = useTranslations("offline");

  useEffect(() => {
    const run = async () => {
      const results = await flushFinishQueue();
      for (const { task, attempt } of results) {
        if (attempt.kind === "done") toast.success(t("finishSynced"), { description: task.name });
        else if (attempt.kind === "drop") toast.error(t("finishDropped"), { description: task.name });
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    void run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(run, RETRY_MS);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [t]);

  return null;
}
