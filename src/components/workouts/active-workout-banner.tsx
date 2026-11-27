"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { ConfirmDialog } from "@/components/workout/dialogs";
import { useNow } from "@/components/workout/hooks";
import { discardWorkout } from "@/lib/workout/actions";
import { storageKey } from "@/lib/workout/store";

/** Хвилини з початку тренування — для "Started 25 min ago" / "Почато 25 хв тому". */
const minutesSince = (ms: number) => Math.max(0, Math.floor(ms / 60_000));

/** Банер незавершеного тренування: Resume → екран тренування, Discard — з підтвердженням. */
export function ActiveWorkoutBanner({
  workout,
}: {
  workout: { id: string; name: string; startedAt: string };
}) {
  const t = useTranslations("workouts.banner");
  const tw = useTranslations("workout");
  const errorText = useErrorText();
  const now = useNow(30_000);
  const minutes = minutesSince(now - new Date(workout.startedAt).getTime());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const discard = () =>
    startTransition(async () => {
      try {
        localStorage.removeItem(storageKey(workout.id));
      } catch {
        // localStorage недоступний — не критично
      }
      const result = await discardWorkout(workout.id, "/workouts");
      if (result?.error) toast.error(errorText(result.error));
      else setConfirmOpen(false);
    });

  return (
    <section
      aria-label={t("inProgress")}
      className="flex flex-col gap-4 rounded-2xl border-2 border-primary bg-primary/6 p-5 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-accent-text uppercase">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {t("inProgress")}
        </p>
        <h2 className="mt-1.5 line-clamp-2 font-heading text-xl leading-tight font-extrabold md:text-2xl">{workout.name}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground" suppressHydrationWarning>
          {minutes < 1
            ? t("startedJustNow")
            : minutes < 60
              ? t("startedMinutes", { minutes })
              : t("startedHours", { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, "0") })}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="h-12 rounded-full px-5 text-sm font-semibold text-muted-foreground transition hover:text-destructive focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          {t("discard")}
        </button>
        <Link
          href={`/workout/${workout.id}`}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] sm:flex-none"
        >
          <Play className="size-4 fill-current" aria-hidden />
          {t("resume")}
        </Link>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={tw("discardDialog.title")}
        description={t("discardText", { name: workout.name })}
        confirmLabel={tw("discardDialog.confirm")}
        destructive
        pending={pending}
        onConfirm={discard}
      />
    </section>
  );
}
