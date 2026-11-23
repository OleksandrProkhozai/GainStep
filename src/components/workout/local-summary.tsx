"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useStore } from "zustand";
import { StatusPill } from "@/components/pwa/connection-pill";
import { useOnline } from "@/components/pwa/use-online";
import { useUnit } from "@/components/preferences/preferences-provider";
import { SummaryView } from "@/components/summary/summary-view";
import { exerciseName } from "@/lib/i18n/names";
import { buildLocalSummary } from "@/lib/offline/local-workout";
import { useOffline } from "@/lib/offline/offline-store";
import type { FinishTask } from "@/lib/offline/outbox";
import type { WorkoutStore } from "@/lib/workout/store";

/** Після "Синхронізовано ✓" — на справжній підсумок із сервера. */
const OPEN_SERVER_SUMMARY_MS = 1_500;

/**
 * Підсумок тренування, завершеного без мережі: рахується з даних стору
 * тими самими функціями, що й на сервері (summary.ts). Коли черга
 * відправила завершення — показуємо "Синхронізовано ✓" і відкриваємо
 * підсумок із сервера (там є й порівняння з минулим тренуванням).
 */
export function LocalSummary({
  store,
  task,
  programName,
}: {
  store: WorkoutStore;
  task: FinishTask;
  programName: string | null;
}) {
  const t = useTranslations("offline");
  const locale = useLocale();
  const unit = useUnit();
  const router = useRouter();
  const online = useOnline();
  const exercises = useStore(store, (s) => s.exercises);
  const sets = useStore(store, (s) => s.sets);
  const startedAt = useStore(store, (s) => s.meta.startedAt);
  const synced = useOffline((s) => s.lastSynced === task.workoutId);

  const summary = useMemo(
    () => buildLocalSummary({ exercises, sets }, startedAt, task.finishedAt, (e) => exerciseName(e, locale)),
    [exercises, sets, startedAt, task.finishedAt, locale],
  );

  useEffect(() => {
    if (!synced) return;
    const id = setTimeout(() => router.replace(`/workout/${task.workoutId}/summary`), OPEN_SERVER_SUMMARY_MS);
    return () => clearTimeout(id);
  }, [synced, router, task.workoutId]);

  return (
    <>
      <SummaryView
        data={{
          workoutId: task.workoutId,
          name: task.name,
          programName,
          dayName: null,
          startedAt,
          notes: task.notes,
          unit,
          summary,
          nextUp: null,
          planChanges: null,
        }}
        local={
          <p className="flex items-start gap-3 rounded-2xl border border-orange-400/40 bg-orange-400/5 p-4 text-sm text-foreground/85">
            <CloudOff className="mt-0.5 size-4 shrink-0 text-orange-300" aria-hidden />
            {t("savedOnDevice")}
          </p>
        }
      />
      {synced ? (
        <StatusPill tone="synced">{t("pill.synced")}</StatusPill>
      ) : (
        !online && <StatusPill tone="offline">{t("pill.waitingFinish")}</StatusPill>
      )}
    </>
  );
}
