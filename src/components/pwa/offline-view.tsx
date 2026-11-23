"use client";

import { useSyncExternalStore } from "react";
import { CloudOff, Play, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/app-shell/logo";
import { Button } from "@/components/ui/button";
import { LocalWorkout } from "@/components/workout/local-workout";
import { useOffline } from "@/lib/offline/offline-store";
import { STORAGE_PREFIX } from "@/lib/workout/store";

const noopSubscribe = () => () => {};

/** /workout/<uuid> або /workout/<uuid>/summary → id тренування. */
const WORKOUT_PATH = /^\/workout\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/summary)?\/?$/i;

/**
 * Сторінка без мережі. Service worker віддає її замість будь-якої сторінки,
 * якої немає в кеші, тож адреса в рядку — та, яку відкривали:
 *  - сторінка тренування (або його підсумку) зі станом на пристрої —
 *    екран тренування / локальний підсумок зі стору;
 *  - інакше — повідомлення і "Повернутись до тренування", якщо воно є.
 */
export function OfflineView() {
  const path = useSyncExternalStore(
    noopSubscribe,
    () => window.location.pathname,
    () => null,
  );
  if (path === null) return <div className="min-h-dvh flex-1 bg-background" />;

  const workoutId = WORKOUT_PATH.exec(path)?.[1];
  if (workoutId) {
    return (
      <div className="flex min-h-dvh flex-1 flex-col bg-background text-foreground">
        <LocalWorkout workoutId={workoutId} cachedPreferences fallback={<OfflineMessage />} />
      </div>
    );
  }
  return <OfflineMessage />;
}

function hasLocalState(workoutId: string) {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${workoutId}`) !== null;
  } catch {
    return false;
  }
}

/** Документна навігація: без мережі сторінку тренування віддає service worker. */
function resume(workoutId: string) {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- див. вище
  window.location.assign(`/workout/${workoutId}`);
}

function OfflineMessage() {
  const t = useTranslations("offline.page");
  const active = useOffline((s) => s.active);
  const resumable = active && hasLocalState(active.workoutId) ? active : null;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background pt-[calc(env(safe-area-inset-top)+1.25rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pl-[calc(env(safe-area-inset-left)+1rem)] text-foreground md:px-10 md:pt-8">
      <Logo />
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="flex max-w-sm flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl border border-orange-400/40 bg-orange-400/10 text-orange-300">
            <CloudOff className="size-8" aria-hidden />
          </span>
          <h1 className="mt-5 font-heading text-2xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {resumable ? t("workoutSaved") : t("text")}
          </p>
          <div className="mt-6 flex w-full flex-col gap-2">
            {resumable && (
              <Button size="lg" className="h-12 rounded-full text-[15px] font-bold" onClick={() => resume(resumable.workoutId)}>
                <Play className="fill-current" aria-hidden />
                {t("backToWorkout")}
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-full"
              onClick={() => window.location.reload()}
            >
              <RotateCw aria-hidden />
              {t("retry")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
