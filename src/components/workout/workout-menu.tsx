"use client";

import { Ellipsis, Flag, NotebookPen, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useScreen } from "./context";

/** Меню "⋯". На телефоні тут також нотатка й завершення. */
export function WorkoutMenu({ mobile = false }: { mobile?: boolean }) {
  const { requestDiscard, openNote, openAddExercise, requestFinish } = useScreen();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Workout options"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full transition hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
          mobile ? "size-11" : "size-11 border border-white/15",
        )}
      >
        <Ellipsis className="size-6" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {mobile && (
          <>
            <DropdownMenuItem onSelect={openNote}>
              <NotebookPen aria-hidden />
              Add note
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openAddExercise}>
              <Plus aria-hidden />
              Add exercise
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={requestFinish}>
              <Flag aria-hidden />
              Finish workout
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem variant="destructive" onSelect={requestDiscard}>
          <Trash2 aria-hidden />
          Discard workout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
