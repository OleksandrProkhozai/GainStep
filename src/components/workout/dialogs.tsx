"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale, useTranslations } from "next-intl";
import { useMinRest } from "@/components/preferences/preferences-provider";
import { exerciseName } from "@/lib/i18n/names";
import { formatRest } from "@/lib/programs/draft";
import { effectiveRest } from "@/lib/workout/rest";
import { createClient } from "@/lib/supabase/client";
import { loadExerciseHistory, type ExerciseHistory } from "@/lib/workout/queries";
import { ADDED_EXERCISE_DEFAULTS, type WorkoutExercise } from "@/lib/workout/types";
import type { LibraryExercise } from "@/lib/exercises/catalog";
import { toLibraryExercise } from "@/lib/programs/queries";
import { ExercisePicker } from "@/components/exercises/exercise-picker";
import { Switch } from "@/components/ui/switch";
import { useWorkout } from "./context";

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
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="border-foreground/10 bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-foreground/10 bg-foreground/2">
          <Button
            variant="outline"
            className="h-10 rounded-full px-5"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tc("cancel")}
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
  const t = useTranslations("workout");
  const notes = useWorkout((s) => s.notes);
  const setNotes = useWorkout((s) => s.setNotes);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-foreground/10 bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{t("notes")}</DialogTitle>
          <DialogDescription>{t("notesHint")}</DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder={t("notesPlaceholder")}
          aria-label={t("notesLabel")}
          className="w-full resize-none rounded-xl border border-foreground/10 bg-background/70 px-3.5 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20"
        />
        <Button className={`h-11 ${lime}`} onClick={() => onOpenChange(false)}>
          {t("done")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** LibraryExercise + історія → вправа тренування (додана, 3 × 8–12, відпочинок 1:30). */
function toAddedExercise(e: LibraryExercise, history?: ExerciseHistory): WorkoutExercise {
  return {
    exerciseId: e.id,
    name: e.name,
    nameUk: e.nameUk,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    increment: e.incrementKg,
    imagePath: e.imagePath ?? null,
    custom: e.custom,
    isCompound: e.isCompound,
    transitionRestSeconds: null,
    // Відпочинок зберігаємо "сирим": мінімум з налаштувань і перехід між
    // вправами застосовує planRest у момент старту таймера.
    ...ADDED_EXERCISE_DEFAULTS,
    source: "added",
    history: history?.history ?? [],
    best: history?.best ?? null,
  };
}

const LIBRARY_COLUMNS = "id, name, name_uk, muscle_group, equipment, weight_increment, owner_id, image_path, is_compound";

/**
 * Додавання вправ під час тренування: той самий ExercisePicker, що в
 * редакторі програм (пошук, фільтри, "+ Створити власну вправу" — створена
 * одразу вибрана). Вправи тренування позначені "Вже є". За замовчуванням
 * нові вправи стають після поточної, перемикачем — у кінець.
 * Історію вправ (підказка ваги, "Минулого разу") підвантажуємо тим самим
 * запитом, що й сервер.
 */
export function AddExerciseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("workout.addDialog");
  const locale = useLocale();
  const exercises = useWorkout((s) => s.exercises);
  const addExercises = useWorkout((s) => s.addExercises);
  const minRest = useMinRest();
  const [library, setLibrary] = useState<LibraryExercise[] | null>(null);
  const [afterCurrent, setAfterCurrent] = useState(true);

  // Бібліотеку перечитуємо при кожному відкритті: власні вправи могли змінитися.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    createClient()
      .from("exercises")
      .select(LIBRARY_COLUMNS)
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error(t("loadFailed"));
          setLibrary((l) => l ?? []);
          return;
        }
        setLibrary(data.map(toLibraryExercise));
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const addedIds = useMemo(() => new Set(exercises.map((e) => e.exerciseId)), [exercises]);

  const add = async (list: LibraryExercise[]) => {
    if (list.length === 0) return;
    try {
      const history = await loadExerciseHistory(createClient(), list.map((e) => e.id));
      const added = addExercises(
        list.map((e) => toAddedExercise(e, history.get(e.id))),
        afterCurrent ? "afterCurrent" : "end",
      );
      if (added.length > 0) {
        toast.success(
          added.length === 1
            ? t("addedOne", { name: exerciseName(added[0], locale) })
            : t("addedMany", { count: added.length }),
        );
      }
    } catch (error) {
      console.error("add exercise", error);
      toast.error(t("addFailed"));
    }
  };

  return (
    <ExercisePicker
      open={open}
      onOpenChange={onOpenChange}
      exercises={library ?? []}
      loading={library === null}
      addedIds={addedIds}
      addedLabel={t("alreadyIn")}
      title={t("title")}
      description={t("defaults", {
        sets: ADDED_EXERCISE_DEFAULTS.targetSets,
        repMin: ADDED_EXERCISE_DEFAULTS.repMin,
        repMax: ADDED_EXERCISE_DEFAULTS.repMax,
        rest: formatRest(effectiveRest(ADDED_EXERCISE_DEFAULTS.restSeconds, minRest)),
      })}
      footer={
        <label className="mb-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-foreground/4 px-4 py-2">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t("afterCurrent")}</span>
            <span className="block text-xs text-muted-foreground">
              {afterCurrent ? t("afterCurrentHint") : t("atEndHint")}
            </span>
          </span>
          <Switch checked={afterCurrent} onCheckedChange={setAfterCurrent} aria-label={t("afterCurrent")} />
        </label>
      }
      onAdd={(list) => void add(list)}
    />
  );
}

/**
 * Підтвердження прибирання вправи, у якої є виконані підходи
 * ("Прибрати «Жим гантелей»? 2 виконані підходи буде видалено.").
 */
export function RemoveExerciseDialog({
  exercise,
  doneSets,
  onCancel,
  onConfirm,
}: {
  exercise: WorkoutExercise | null;
  doneSets: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("workout.removeDialog");
  const tc = useTranslations("common");
  const locale = useLocale();
  return (
    <AlertDialog open={exercise !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title", { name: exercise ? exerciseName(exercise, locale) : "" })}</AlertDialogTitle>
          <AlertDialogDescription>{t("text", { count: doneSets })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={buttonVariants({ variant: "outline-pill" })}>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={buttonVariants({ variant: "destructive" })}>
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
