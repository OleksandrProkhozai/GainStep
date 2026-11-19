"use client";

import { Ellipsis, Flag, NotebookPen, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useScreen } from "./context";

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
        <DropdownMenuItem variant="destructive" onSelect={requestDiscard}>
          <Trash2 aria-hidden />
          {t("discard")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
