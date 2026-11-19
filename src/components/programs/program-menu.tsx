"use client";

import { useState, useTransition } from "react";
import { Camera, CircleCheck, Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
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
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteProgram, duplicateProgram, setActiveProgram } from "@/lib/programs/actions";

/** Меню «…» редактора: Set as active, Rename, Change photo, Duplicate, Delete. */
export function ProgramMenu({
  programId,
  name,
  isActive,
  dirty,
  onRename,
  onChangePhoto,
}: {
  programId: string;
  name: string;
  isActive: boolean;
  /** Є незбережені зміни — Duplicate копіює збережену версію, попереджаємо. */
  dirty: boolean;
  onRename: () => void;
  onChangePhoto: () => void;
}) {
  const t = useTranslations("programs.menu");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (action: () => Promise<{ ok: boolean; error?: string } | void>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) toast.error(errorText(result.error ?? "generic"));
      else if (success) toast.success(success);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("label")}
          disabled={pending}
          className={buttonVariants({ variant: "outline-pill", size: "icon-sm" })}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MoreHorizontal className="size-5" aria-hidden />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {!isActive && (
            <DropdownMenuItem onSelect={() => run(() => setActiveProgram(programId), t("activated"))}>
              <CircleCheck aria-hidden />
              {t("setActive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onRename}>
            <Pencil aria-hidden />
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onChangePhoto}>
            <Camera aria-hidden />
            {t("changePhoto")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (dirty) toast.info(t("duplicatingSaved"));
              run(() => duplicateProgram(programId));
            }}
          >
            <Copy aria-hidden />
            {t("duplicate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !pending && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteText")}
              {isActive && (
                <>
                  {" "}
                  <strong className="font-semibold text-foreground">
                    {t("deleteActiveWarning")}
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={buttonVariants({ variant: "outline-pill" })}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                run(() => deleteProgram(programId));
              }}
              className={buttonVariants({ variant: "destructive" })}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
