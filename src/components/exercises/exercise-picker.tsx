"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/programs/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  EMPTY_FILTER,
  filterExercises,
  type ExerciseFilter,
  type LibraryExercise,
} from "@/lib/exercises/catalog";
import { exerciseName } from "@/lib/i18n/names";
import { cn } from "@/lib/utils";
import { ExerciseFormDialog } from "./exercise-form-dialog";
import { ExerciseThumb } from "./exercise-thumb";
import { ExerciseFilters } from "./parts";

/**
 * Вибір вправ для дня програми: ті самі пошук, фільтри й список, що в
 * бібліотеці. Мультивибір круглими чекбоксами; вправи, що вже є в дні, —
 * сірі "Added". Десктоп — Dialog, телефон — нижній лист.
 */
export function ExercisePicker({
  open,
  onOpenChange,
  exercises,
  addedIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: LibraryExercise[];
  /** exercise_id, що вже є в цьому дні. */
  addedIds: ReadonlySet<string>;
  onAdd: (exercises: LibraryExercise[]) => void;
}) {
  const t = useTranslations("exercises.picker");
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      srOnlyDescription
      className="lg:h-[80dvh] lg:max-w-xl"
    >
      {open && (
        <PickerBody
          exercises={exercises}
          addedIds={addedIds}
          onAdd={(list) => {
            onAdd(list);
            onOpenChange(false);
          }}
        />
      )}
    </ResponsiveModal>
  );
}

function PickerBody({
  exercises,
  addedIds,
  onAdd,
}: {
  exercises: LibraryExercise[];
  addedIds: ReadonlySet<string>;
  onAdd: (exercises: LibraryExercise[]) => void;
}) {
  const t = useTranslations("exercises.picker");
  const tx = useTranslations("exercises");
  const tm = useTranslations("common.enums.muscle");
  const tq = useTranslations("common.enums.equipment");
  const locale = useLocale();
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<string[]>([]);
  // Вправи, створені просто з picker-а (до оновлення сторінки сервером).
  const [created, setCreated] = useState<LibraryExercise[]>([]);
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => {
    const known = new Set(exercises.map((e) => e.id));
    return [...exercises, ...created.filter((e) => !known.has(e.id))].sort((a, b) =>
      exerciseName(a, locale).localeCompare(exerciseName(b, locale), locale),
    );
  }, [exercises, created, locale]);
  const list = filterExercises(all, filter);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const n = selected.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ExerciseFilters filter={filter} onChange={setFilter} className="px-4 pb-3 lg:px-5" />

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 lg:px-3" aria-label={tx("listLabel")}>
        {list.map((ex) => {
          const added = addedIds.has(ex.id);
          const checked = selected.includes(ex.id);
          return (
            <li key={ex.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={added || checked}
                aria-disabled={added}
                disabled={added}
                onClick={() => toggle(ex.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                  added ? "opacity-55" : "hover:bg-foreground/4 active:bg-foreground/6",
                )}
              >
                <ExerciseThumb exercise={ex} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{exerciseName(ex, locale)}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {tm(ex.muscleGroup)} · {tq(ex.equipment)}
                    {ex.custom && ` · ${tx("custom")}`}
                  </span>
                </span>
                {added ? (
                  <span className="shrink-0 rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {t("added")}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full transition",
                      checked ? "bg-primary text-primary-foreground" : "border-2 border-foreground/35",
                    )}
                  >
                    {checked && <Check className="size-4" strokeWidth={3} />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">{t("noMatch")}</li>
        )}
      </ul>

      <div className="border-t border-foreground/5 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:px-5 lg:pb-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCreating(true)}
          className="mx-auto mb-2 flex text-accent-text hover:bg-primary/8 hover:text-accent-text"
        >
          <Plus aria-hidden />
          {t("createCustom")}
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={n === 0}
          onClick={() => onAdd(selected.map((id) => all.find((e) => e.id === id)!).filter(Boolean))}
          className="w-full"
        >
          {n === 0 ? t("addNone") : t("addCount", { count: n })}
        </Button>
      </div>

      <ExerciseFormDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={filter.q.trim()}
        onSaved={(ex) => {
          setCreated((c) => [...c, ex]);
          setSelected((s) => [...s, ex.id]);
        }}
      />
    </div>
  );
}
