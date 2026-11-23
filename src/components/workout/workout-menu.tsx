"use client";

import { Ellipsis, Flag, ListX, NotebookPen, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useScreen, useWorkout } from "./context";

/** Меню "⋯". На телефоні тут також нотатка й завершення. */
export function WorkoutMenu({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslations("workout");
  const { requestDiscard, openNote, openAddExercise, requestFinish } = useScreen();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("options")}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
          mobile ? "size-11" : "size-11 border border-foreground/15",
        )}
      >
        <Ellipsis className="size-6" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {mobile && (
          <>
            <DropdownMenuItem onSelect={openNote}>
              <NotebookPen aria-hidden />
              {t("addNote")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openAddExercise}>
              <Plus aria-hidden />
              {t("addExercise")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={requestFinish}>
              <Flag aria-hidden />
              {t("finish")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {!mobile && (
          <>
            <DropdownMenuItem onSelect={openAddExercise}>
              <Plus aria-hidden />
              {t("addExercise")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem variant="destructive" onSelect={requestDiscard}>
          <Trash2 aria-hidden />
          {t("discard")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Меню "⋯" картки вправи: "Прибрати з тренування". Останню вправу
 * прибрати не можна — пункт неактивний з підказкою.
 */
export function ExerciseMenu({ exerciseId, className }: { exerciseId: string; className?: string }) {
  const t = useTranslations("workout");
  const { requestRemoveExercise } = useScreen();
  const only = useWorkout((s) => s.exercises.length <= 1);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("exerciseOptions")}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
          className,
        )}
      >
        <Ellipsis className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          variant="destructive"
          disabled={only}
          onSelect={() => requestRemoveExercise(exerciseId)}
        >
          <ListX aria-hidden />
          <span className="flex flex-col">
            {t("removeExercise")}
            {only && <span className="text-xs text-muted-foreground">{t("removeLastHint")}</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
