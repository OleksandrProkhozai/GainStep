"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, MoreHorizontal, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useErrorText } from "@/components/i18n/use-error-text";
import { useWeightFormat } from "@/components/i18n/use-format";
import { deleteExercise } from "@/lib/exercises/actions";
import { exerciseName } from "@/lib/i18n/names";
import {
  filterExercises,
  parseFilter,
  type ExerciseFilter,
  type LibraryExercise,
} from "@/lib/exercises/catalog";
import { ExerciseFormDialog } from "./exercise-form-dialog";
import { ExerciseThumb } from "./exercise-thumb";
import { ExerciseFilters } from "./parts";

/** Стан фільтра → search params (порожні значення не пишемо). */
function toSearch(filter: ExerciseFilter) {
  const params = new URLSearchParams();
  if (filter.q.trim()) params.set("q", filter.q.trim());
  if (filter.muscle) params.set("muscle", filter.muscle);
  if (filter.equipment) params.set("equipment", filter.equipment);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Бібліотека вправ (/exercises). Пошук і фільтри живуть у search params,
 * тож посилання з фільтром можна відкрити знову.
 */
export function ExerciseLibrary({ exercises }: { exercises: LibraryExercise[] }) {
  const t = useTranslations("exercises");
  const tm = useTranslations("common.enums.muscle");
  const tq = useTranslations("common.enums.equipment");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = parseFilter(params);
  // Порядок — за назвою мовою інтерфейсу.
  const list = filterExercises(exercises, filter).sort((a, b) =>
    exerciseName(a, locale).localeCompare(exerciseName(b, locale), locale),
  );

  const [form, setForm] = useState<{ exercise?: LibraryExercise; initialName?: string } | null>(null);
  const [toDelete, setToDelete] = useState<LibraryExercise | null>(null);

  const setFilter = (next: ExerciseFilter) =>
    router.replace(`${pathname}${toSearch(next)}`, { scroll: false });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("count", { total: exercises.length, custom: exercises.filter((e) => e.custom).length })}
        </p>
        <Button type="button" onClick={() => setForm({})}>
          <Plus aria-hidden />
          {t("create")}
        </Button>
      </div>

      <ExerciseFilters filter={filter} onChange={setFilter} />

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-foreground/10 bg-card px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-foreground/6 text-muted-foreground">
            <SearchX className="size-6" aria-hidden />
          </span>
          <p className="mt-3 font-heading text-lg font-bold">{t("empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("empty.text")}</p>
          {filter.q.trim() && (
            <Button type="button" onClick={() => setForm({ initialName: filter.q.trim() })} className="mt-5 max-w-full">
              <Plus aria-hidden />
              <span className="truncate">{t("createNamed", { name: filter.q.trim() })}</span>
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label={t("listLabel")}>
          {list.map((ex) => (
            <li
              key={ex.id}
              className="relative flex min-w-0 flex-col gap-2.5 rounded-2xl border border-foreground/10 bg-card p-2.5"
            >
              <ExerciseThumb exercise={ex} size="lg" />
              {ex.custom && (
                <span className="absolute top-4 left-4 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold tracking-wide text-foreground/85 uppercase backdrop-blur">
                  {t("custom")}
                </span>
              )}
              <div className="min-w-0 px-1 pb-1">
                <p className="line-clamp-2 text-[15px] leading-snug font-semibold">{exerciseName(ex, locale)}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {tm(ex.muscleGroup)} · {tq(ex.equipment)}
                  {ex.equipment !== "bodyweight" && <> · +{fmt.weight(ex.incrementKg)}</>}
                </p>
              </div>
              {ex.custom && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t("actionsFor", { name: exerciseName(ex, locale) })}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                      className: "absolute top-3.5 right-3.5 bg-background/70 text-foreground backdrop-blur hover:bg-background/90",
                    })}
                  >
                    <MoreHorizontal className="size-5" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => setForm({ exercise: ex })}>
                      <Pencil aria-hidden />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(ex)}>
                      <Trash2 aria-hidden />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}

      <ExerciseFormDialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        exercise={form?.exercise}
        initialName={form?.initialName}
        onSaved={() => router.refresh()}
      />
      <DeleteExerciseDialog exercise={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}

function DeleteExerciseDialog({ exercise, onClose }: { exercise: LibraryExercise | null; onClose: () => void }) {
  const t = useTranslations("exercises.deleteDialog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog open={exercise !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title", { name: exercise ? exerciseName(exercise, locale) : "" })}</AlertDialogTitle>
          <AlertDialogDescription>{t("text")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={buttonVariants({ variant: "outline-pill" })}>
            {tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              if (!exercise) return;
              startTransition(async () => {
                const result = await deleteExercise(exercise.id);
                if (result.ok) {
                  toast.success(t("deleted"));
                  onClose();
                } else {
                  toast.error(errorText(result.error));
                }
              });
            }}
            className={buttonVariants({ variant: "destructive" })}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
