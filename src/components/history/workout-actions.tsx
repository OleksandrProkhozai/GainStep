"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteWorkout } from "@/lib/history/actions";
import { HISTORY_PATH } from "@/lib/history/url";
import { cn } from "@/lib/utils";
import { ShareButton, useShareWorkout, type ShareableWorkout } from "./share-button";

/** Підтвердження видалення → server action → історія + toast. */
function DeleteDialog({
  workout,
  open,
  onOpenChange,
}: {
  workout: ShareableWorkout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("history.detail");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await deleteWorkout(workout.id);
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      onOpenChange(false);
      toast.success(t("deleted"));
      router.replace(HISTORY_PATH);
    });

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent className="border-foreground/10 bg-card text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDialog.text", { name: workout.name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 rounded-full px-5" disabled={pending}>
            {tc("cancel")}
          </AlertDialogCancel>
          {/* Не AlertDialogAction: він закрив би діалог до завершення дії. */}
          <Button
            variant="destructive"
            className="h-10 rounded-full px-5 font-bold"
            onClick={confirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("deleteDialog.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Меню "…" у шапці: Редагувати, Поділитися, Видалити. */
export function WorkoutMenu({ workout, className }: { workout: ShareableWorkout; className?: string }) {
  const t = useTranslations("history.detail");
  const router = useRouter();
  const { share, prefetch } = useShareWorkout(workout);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <DropdownMenu onOpenChange={(o) => o && prefetch()}>
        <DropdownMenuTrigger
          aria-label={t("menu")}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-card transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
            className,
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onSelect={() => router.push(`/workouts/${workout.id}/edit`)}>
            <Pencil aria-hidden />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void share()}>
            <Share2 aria-hidden />
            {t("share")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteDialog workout={workout} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

const outline =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-foreground/25 px-5 text-sm font-bold transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98]";

/** Кнопки desktop у шапці: Редагувати (outline) і Поділитися (лайм). */
export function WorkoutHeaderActions({ workout }: { workout: ShareableWorkout }) {
  const t = useTranslations("history.detail");
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href={`/workouts/${workout.id}/edit`} className={cn(outline, "h-11")}>
        <Pencil className="size-4" aria-hidden />
        {t("edit")}
      </Link>
      <ShareButton workout={workout} variant="lime" />
    </div>
  );
}

/**
 * Телефон: липка нижня панель над навігацією — "Редагувати" (outline) і
 * "Поділитися" (лайм), над нею червоне посилання "Видалити тренування".
 */
export function WorkoutBottomBar({ workout }: { workout: ShareableWorkout }) {
  const t = useTranslations("history.detail");
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 bg-linear-to-t from-background from-75% to-background/0 px-[max(1rem,env(safe-area-inset-left))] pt-6 pb-3 md:hidden">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="inline-flex h-9 items-center px-3 text-sm font-semibold text-destructive underline-offset-4 hover:underline focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          {t("delete")}
        </button>
        <div className="flex w-full gap-2.5">
          <Link href={`/workouts/${workout.id}/edit`} className={cn(outline, "flex-1")}>
            {t("edit")}
          </Link>
          <ShareButton workout={workout} variant="lime" className="h-12 flex-1" />
        </div>
      </div>
      <DeleteDialog workout={workout} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
