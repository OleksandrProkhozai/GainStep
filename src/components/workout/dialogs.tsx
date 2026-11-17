"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { loadExerciseHistory, toWorkoutExercise } from "@/lib/workout/queries";
import { ADDED_EXERCISE_DEFAULTS, type Equipment, type MuscleGroup } from "@/lib/workout/types";
import { useWorkout } from "./context";
import { ExerciseIcon } from "./parts";

const lime = "rounded-full bg-primary font-bold text-primary-foreground hover:bg-primary/90";

/** Підтвердження дії (завершення / скасування тренування). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="dark border-white/10 bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-white/10 bg-white/2">
          <Button
            variant="outline"
            className="h-10 rounded-full px-5"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className={destructive ? "h-10 rounded-full px-5 font-bold" : `h-10 px-5 ${lime}`}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Нотатка до тренування (на телефоні — з меню "⋯"). */
export function NoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const notes = useWorkout((s) => s.notes);
  const setNotes = useWorkout((s) => s.setNotes);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark border-white/10 bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Notes</DialogTitle>
          <DialogDescription>Saved with the workout when you finish it.</DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="How did it feel?"
          aria-label="Workout notes"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20"
        />
        <Button className={`h-11 ${lime}`} onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}

type ExerciseOption = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  weight_increment: number;
  owner_id: string | null;
};

/**
 * Додавання вправи: пошук по бібліотеці (системні + власні — RLS),
 * вправа додається в кінець з параметрами 3 × 8–12, відпочинок 90 с.
 * Історію вправи підвантажуємо тим самим запитом, що й сервер.
 */
export function AddExerciseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const exercises = useWorkout((s) => s.exercises);
  const addExercise = useWorkout((s) => s.addExercise);
  const [options, setOptions] = useState<ExerciseOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open || options) return;
    let cancelled = false;
    createClient()
      .from("exercises")
      .select("id, name, muscle_group, equipment, weight_increment, owner_id")
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Couldn't load exercises");
          return;
        }
        setOptions(data);
      });
    return () => {
      cancelled = true;
    };
  }, [open, options]);

  const filtered = useMemo(() => {
    const taken = new Set(exercises.map((e) => e.exerciseId));
    const q = query.trim().toLowerCase();
    return (options ?? []).filter(
      (o) =>
        !taken.has(o.id) &&
        (!q || o.name.toLowerCase().includes(q) || o.muscle_group.includes(q) || o.equipment.includes(q)),
    );
  }, [options, exercises, query]);

  const pick = async (option: ExerciseOption) => {
    setAdding(option.id);
    try {
      const history = await loadExerciseHistory(createClient(), [option.id]);
      addExercise(toWorkoutExercise(option, { ...ADDED_EXERCISE_DEFAULTS }, history.get(option.id)));
      setQuery("");
      onOpenChange(false);
    } catch (error) {
      console.error("add exercise", error);
      toast.error("Couldn't add the exercise. Check your connection.");
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark flex max-h-[min(640px,85dvh)] flex-col border-white/10 bg-card text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Add exercise</DialogTitle>
          <DialogDescription>3 sets × 8–12 reps, 90 s rest</DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 pr-3 pl-10 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20"
          />
        </label>
        <div className="-mx-1 min-h-40 flex-1 overflow-y-auto px-1">
          {!options ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-label="Loading" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No exercises found</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={adding !== null}
                    onClick={() => pick(o)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-60"
                  >
                    <ExerciseIcon equipment={o.equipment} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{o.name}</span>
                      <span className="block text-xs text-muted-foreground capitalize">
                        {o.muscle_group} · {o.equipment}
                        {o.owner_id && " · custom"}
                      </span>
                    </span>
                    {adding === o.id && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
