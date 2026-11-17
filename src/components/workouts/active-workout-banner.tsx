"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/workout/dialogs";
import { useNow } from "@/components/workout/hooks";
import { discardWorkout } from "@/lib/workout/actions";
import { storageKey } from "@/lib/workout/store";

/** "just now" / "25 min ago" / "1 h 05 min ago". */
function startedAgo(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h ago` : `${h} h ${String(m).padStart(2, "0")} min ago`;
}

/** Банер незавершеного тренування: Resume → екран тренування, Discard — з підтвердженням. */
export function ActiveWorkoutBanner({
  workout,
}: {
  workout: { id: string; name: string; startedAt: string };
}) {
  const now = useNow(30_000);
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
      if (result?.error) toast.error(result.error);
      else setConfirmOpen(false);
    });

  return (
    <section
      aria-label="Workout in progress"
      className="flex flex-col gap-4 rounded-2xl border-2 border-primary bg-primary/6 p-5 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Workout in progress
        </p>
        <h2 className="mt-1.5 truncate font-heading text-xl font-extrabold md:text-2xl">{workout.name}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground" suppressHydrationWarning>
          Started {startedAgo(now - new Date(workout.startedAt).getTime())}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="h-12 rounded-full px-5 text-sm font-semibold text-muted-foreground transition hover:text-destructive focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          Discard
        </button>
        <Link
          href={`/workout/${workout.id}`}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] sm:flex-none"
        >
          <Play className="size-4 fill-current" aria-hidden />
          Resume
        </Link>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Discard workout?"
        description={`"${workout.name}" and all its sets will be deleted. This can't be undone.`}
        confirmLabel="Discard"
        destructive
        pending={pending}
        onConfirm={discard}
      />
    </section>
  );
}
