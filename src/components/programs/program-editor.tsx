"use client";

import { useEffect, useMemo, useReducer, useState, useTransition } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronLeft, Copy, Info, Loader2, Lock, MoreHorizontal, Pencil, Play, Plus, Star, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { ExercisePicker } from "@/components/exercises/exercise-picker";
import { useMinRest, useTransitionRestEnabled, useUnit } from "@/components/preferences/preferences-provider";
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
import type { LibraryExercise } from "@/lib/exercises/catalog";
import { cloneTemplate, saveProgram } from "@/lib/programs/actions";
import { OFFER_ACTIVATE_PARAM } from "@/lib/programs/active";
import {
  buildSavePayload,
  dayStats,
  draftReducer,
  isDraftDirty,
  NEW_EXERCISE_DEFAULTS,
  nextDayName,
  type DraftExercise,
} from "@/lib/programs/draft";
import { nextChip, nextInput } from "@/lib/programs/next";
import { suggestNextWeight } from "@/lib/progression";
import { explainSuggestion } from "@/lib/progression-explain";
import { effectiveRest } from "@/lib/workout/rest";
import type { ProgramEditorData } from "@/lib/programs/queries";
import {
  dayNameSchema,
  firstIssue,
  issueDayIndex,
  PROGRAM_LIMITS,
  programNameSchema,
  saveProgramSchema,
} from "@/lib/programs/schema";
import { cn } from "@/lib/utils";
import { StartWorkoutForm } from "@/components/workout/start-workout-form";
import { useActivateProgramAction, useActiveProgram } from "./active-program";
import { ExerciseRow } from "./exercise-row";
import { ProgramThumb } from "./program-thumb";
import { NameDialog } from "./name-dialog";
import { PendingButton } from "./pending-button";
import { ProgramMenu } from "./program-menu";
import { ProgramPhotoDialog } from "./program-photo-dialog";
import { UnsavedGuard } from "./unsaved-guard";
import { LevelBadge, useScheduleText } from "./template-info";

let keySeq = 0;
const newKey = (prefix: string) => `${prefix}-new-${Date.now().toString(36)}-${++keySeq}`;

/**
 * Редактор програми. Уся програма — локальна чернетка (useReducer);
 * збереження — одним server action (RPC save_program, одна транзакція).
 * Шаблон (owner_id = null) відкривається лише для перегляду.
 * offerActivate — щойно створена програма, що не стала активною: після
 * першого збереження — діалог «Зробити «…» активною?».
 */
export function ProgramEditor({ data, offerActivate = false }: { data: ProgramEditorData; offerActivate?: boolean }) {
  const { program, library, history } = data;
  // Одиниці й мова — для чипа Next (крок 5 lb) і пояснення "Чому така вага?".
  const unit = useUnit();
  const locale = useLocale();
  const t = useTranslations("programs.editor");
  const ta = useTranslations("programs.active");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  // Мінімальний відпочинок з Settings: лише при показі (чипи, ~хв) і для нових вправ.
  const minRest = useMinRest();
  const transitionRest = useTransitionRestEnabled();
  const readOnly = program.isTemplate;
  const schedule = useScheduleText();

  const [draft, dispatch] = useReducer(draftReducer, data.draft);
  const [dayIndex, setDayIndex] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renaming, setRenaming] = useState<null | "program" | "day">(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  // Активна програма — зі спільного стану списку й редактора (оптимістично).
  const { activeId, pending: activating, activate } = useActiveProgram();
  const isActive = !readOnly && activeId === program.id;
  const makeActive = () => activate({ id: program.id, name: draft.name });
  const [offer, setOffer] = useState(offerActivate);
  const [offerOpen, setOfferOpen] = useState(false);

  // ?new=1 прибираємо з адреси одразу: оновлення сторінки не повторює пропозицію.
  useEffect(() => {
    if (!offerActivate) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(OFFER_ACTIVATE_PARAM);
    window.history.replaceState(null, "", url);
  }, [offerActivate]);

  // Після збереження сервер віддає нову версію (updated_at) — скидаємо чернетку
  // до збережених даних (у нових днів і вправ з'являються id).
  const [version, setVersion] = useState(program.version);
  if (program.version !== version) {
    setVersion(program.version);
    dispatch({ type: "reset", draft: data.draft });
  }

  const dirty = !readOnly && isDraftDirty(data.draft, draft);
  const activeIndex = Math.min(dayIndex, draft.days.length - 1);
  const day = draft.days[activeIndex];

  const sensors = useSensors(
    // Мінімальна відстань / затримка — щоб скрол на телефоні не вмикав drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addedIds = useMemo(() => new Set(day?.exercises.map((e) => e.exerciseId) ?? []), [day]);

  if (!day) return null;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = day.exercises.findIndex((e) => e.key === active.id);
    const to = day.exercises.findIndex((e) => e.key === over.id);
    dispatch({ type: "moveExercise", dayKey: day.key, from, to });
  };

  const addExercises = (list: LibraryExercise[]) => {
    const rows: DraftExercise[] = list.map((ex) => ({
      key: newKey("ex"),
      id: null,
      exerciseId: ex.id,
      name: ex.name,
      nameUk: ex.nameUk,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      incrementKg: ex.incrementKg,
      imagePath: ex.imagePath ?? null,
      custom: ex.custom,
      isCompound: ex.isCompound,
      transitionRestSeconds: null,
      ...NEW_EXERCISE_DEFAULTS,
      restSeconds: effectiveRest(NEW_EXERCISE_DEFAULTS.restSeconds, minRest),
    }));
    dispatch({ type: "addExercises", dayKey: day.key, exercises: rows });
    setExpandedKey(null);
  };

  const save = () => {
    const parsed = saveProgramSchema.safeParse(buildSavePayload(draft));
    if (!parsed.success) {
      // Перехід на день з помилкою; назва дня — у тексті помилки.
      const dayIdx = issueDayIndex(parsed.error);
      if (dayIdx !== null) setDayIndex(dayIdx);
      const dayName = dayIdx !== null ? draft.days[dayIdx]?.name || t("untitled") : "";
      toast.error(errorText(firstIssue(parsed.error), { day: dayName }));
      return;
    }
    startSaving(async () => {
      const result = await saveProgram(program.id, parsed.data);
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      toast.success(t("saved"));
      if (offer) {
        setOffer(false);
        if (!isActive) setOfferOpen(true);
      }
    });
  };

  const discard = () => {
    dispatch({ type: "reset", draft: data.draft });
    setExpandedKey(null);
  };

  return (
    <div className={cn("min-w-0", dirty && "pb-20 md:pb-0")}>
      {/* Шапка */}
      <header className="flex items-center gap-2">
        <Link
          href="/programs"
          aria-label={t("back")}
          className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "-ml-2 lg:hidden" })}
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        {readOnly ? (
          <ProgramThumb
            program={{ id: program.id, name: draft.name, sourceTemplateId: program.sourceTemplateId, isTemplate: true }}
            size="md"
            className="mr-1"
          />
        ) : (
          // Власна програма: клік по мініатюрі — змінити фото.
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label={t("changePhoto")}
            title={t("changePhoto")}
            className="group/photo relative mr-1 shrink-0 rounded-2xl focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <ProgramThumb
              program={{
                id: program.id,
                name: draft.name,
                sourceTemplateId: program.sourceTemplateId,
                imagePath: program.imagePath,
                isTemplate: false,
              }}
              size="md"
              active={isActive}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl bg-black/0 transition group-hover/photo:bg-black/25"
            />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {readOnly && <Lock className="size-5 shrink-0 text-muted-foreground" aria-label={t("readOnly")} />}
            <h1 className="line-clamp-2 min-w-0 font-heading text-2xl leading-tight [overflow-wrap:anywhere] font-extrabold tracking-tight lg:text-[28px]">
              {draft.name}
            </h1>
            {isActive && (
              <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                {t("active")}
              </span>
            )}
            {readOnly && (
              <span className="shrink-0 rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-bold text-foreground/85">
                {t("template")}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {readOnly
              ? schedule(program.daysPerWeek, draft.days.length)
              : t("meta", {
                  days: draft.days.length,
                  exercises: draft.days.reduce((s, d) => s + d.exercises.length, 0),
                })}
            {readOnly && program.level && <LevelBadge level={program.level} />}
          </p>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline-pill"
              size="sm"
              onClick={() => setRenaming("program")}
              className="max-sm:hidden"
            >
              <Pencil aria-hidden />
              {t("rename")}
            </Button>
            {!isActive && <MakeActiveButton onClick={makeActive} pending={activating} className="max-sm:hidden" />}
            <ProgramMenu
              programId={program.id}
              name={draft.name}
              isActive={isActive}
              dirty={dirty}
              onSetActive={makeActive}
              onRename={() => setRenaming("program")}
              onChangePhoto={() => setPhotoOpen(true)}
            />
          </div>
        )}
      </header>

      {/* Телефон: «Зробити активною» на всю ширину під назвою */}
      {!readOnly && !isActive && (
        <MakeActiveButton onClick={makeActive} pending={activating} className="mt-3 w-full sm:hidden" />
      )}

      {readOnly && (
        <form action={cloneTemplate.bind(null, program.id)} className="mt-4">
          <PendingButton variant="outline-pill" size="lg" className="w-full">
            <Copy aria-hidden />
            {t("useTemplate")}
          </PendingButton>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t("templateHint")}
          </p>
        </form>
      )}

      {readOnly && <TemplateOverview description={program.description} days={draft.days} />}

      {/* Вкладки днів */}
      <div
        role="tablist"
        aria-label={t("days")}
        className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0"
      >
        {draft.days.map((d, i) => {
          const selected = i === activeIndex;
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="day-panel"
              onClick={() => {
                setDayIndex(i);
                setExpandedKey(null);
              }}
              className={cn(
                "h-11 shrink-0 rounded-full px-5 text-sm font-bold whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/85 hover:bg-foreground/10",
              )}
            >
              {d.name || t("untitled")}
            </button>
          );
        })}
        {!readOnly && (
          <Button
            type="button"
            variant="outline-pill"
            disabled={draft.days.length >= PROGRAM_LIMITS.daysMax}
            onClick={() => {
              dispatch({ type: "addDay", key: newKey("day"), name: nextDayName(draft.days, t("dayWord")) });
              setDayIndex(draft.days.length);
              setExpandedKey(null);
            }}
            title={draft.days.length >= PROGRAM_LIMITS.daysMax ? errorText("programMaxDays") : undefined}
            className="h-11 px-4 disabled:opacity-40"
          >
            <Plus aria-hidden />
            {t("addDay")}
          </Button>
        )}
      </div>

      {/* День */}
      <section id="day-panel" role="tabpanel" aria-label={day.name} className="mt-4">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground/85">{t("daySummary", dayStats(day.exercises, minRest, transitionRest))}</p>
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("dayActions", { name: day.name })}
                className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "text-muted-foreground" })}
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setRenaming("day")}>
                  <Pencil aria-hidden />
                  {t("renameDay")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={draft.days.length <= PROGRAM_LIMITS.daysMin}
                  onSelect={() => {
                    dispatch({ type: "removeDay", dayKey: day.key });
                    setDayIndex(Math.max(0, activeIndex - 1));
                  }}
                >
                  <Trash2 aria-hidden />
                  {t("deleteDay")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {day.exercises.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-foreground/15 px-4 py-6 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden />
            {t("emptyDay")}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={day.exercises.map((e) => e.key)} strategy={verticalListSortingStrategy}>
              <ul className="mt-2 space-y-2" aria-label={t("dayExercises", { name: day.name })}>
                {day.exercises.map((e) => (
                  <ExerciseRow
                    key={e.key}
                    exercise={e}
                    chip={nextChip(e, history, unit)}
                    why={(() => {
                      const input = nextInput(e, history, unit);
                      return explainSuggestion({ ...input, unit }, suggestNextWeight(input), locale);
                    })()}
                    readOnly={readOnly}
                    expanded={expandedKey === e.key}
                    onToggle={() => setExpandedKey((k) => (k === e.key ? null : e.key))}
                    onChange={(patch) => dispatch({ type: "updateExercise", dayKey: day.key, key: e.key, patch })}
                    onRemove={() => {
                      dispatch({ type: "removeExercise", dayKey: day.key, key: e.key });
                      setExpandedKey(null);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-line text-sm font-semibold text-foreground/85 transition hover:border-primary hover:text-accent-text focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <Plus className="size-4" aria-hidden />
              {t("addExercise")}
            </button>

            <StartDay
              dayId={day.id}
              dayName={day.name}
              program={isActive ? null : { id: program.id, name: draft.name }}
              disabled={dirty || day.exercises.length === 0}
              hint={dirty ? t("saveFirst") : day.exercises.length === 0 ? t("addExercisesFirst") : null}
            />
          </>
        )}
      </section>

      {/* Незбережені зміни */}
      {dirty && (
        <div
          role="region"
          aria-label={t("unsaved")}
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 md:sticky md:bottom-4 md:mt-5 md:px-0 md:pb-0"
        >
          <div className="flex items-center gap-2 rounded-full border border-foreground/10 bg-muted/95 py-1.5 pr-1.5 pl-5 shadow-2xl backdrop-blur-xl">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{t("unsaved")}</p>
            <Button type="button" variant="outline-pill" size="sm" onClick={discard} disabled={saving}>
              {tc("discard")}
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={saving} aria-busy={saving} className="px-6">
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {tc("save")}
            </Button>
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          <ExercisePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            exercises={library}
            addedIds={addedIds}
            onAdd={addExercises}
          />
          {!readOnly && (
            <ProgramPhotoDialog
              open={photoOpen}
              onOpenChange={setPhotoOpen}
              program={{ id: program.id, name: draft.name, sourceTemplateId: program.sourceTemplateId, imagePath: program.imagePath }}
            />
          )}
          <NameDialog
            open={renaming === "program"}
            onOpenChange={(open) => !open && setRenaming(null)}
            title={t("renameProgram.title")}
            description={t("renameProgram.description")}
            label={t("renameProgram.label")}
            initialValue={draft.name}
            schema={programNameSchema}
            submitLabel={t("rename")}
            onSubmit={(name) => {
              dispatch({ type: "rename", name });
              setRenaming(null);
              return null;
            }}
          />
          <NameDialog
            open={renaming === "day"}
            onOpenChange={(open) => !open && setRenaming(null)}
            title={t("renameDayDialog.title")}
            description={t("renameDayDialog.description")}
            label={t("renameDayDialog.label")}
            initialValue={day.name}
            schema={dayNameSchema}
            submitLabel={t("rename")}
            onSubmit={(name) => {
              dispatch({ type: "renameDay", dayKey: day.key, name });
              setRenaming(null);
              return null;
            }}
          />
          <UnsavedGuard dirty={dirty} />
          <AlertDialog open={offerOpen} onOpenChange={setOfferOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{ta("offerTitle", { name: draft.name })}</AlertDialogTitle>
                <AlertDialogDescription>{ta("offerText")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className={buttonVariants({ variant: "outline-pill" })}>{ta("later")}</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants()}
                  onClick={() => {
                    setOfferOpen(false);
                    makeActive();
                  }}
                >
                  <Star aria-hidden />
                  {ta("yes")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

/** «Start {Day} day» → StartWorkoutForm (startWorkout; без мережі — на пристрої). Неактивна, поки є незбережені зміни. */
function StartDay({
  dayId,
  dayName,
  program,
  disabled,
  hint,
}: {
  dayId: string | null;
  dayName: string;
  /** Неактивна програма — після старту пропонуємо зробити її активною. */
  program: { id: string; name: string } | null;
  disabled: boolean;
  hint: string | null;
}) {
  const t = useTranslations("programs.editor");
  const ta = useTranslations("programs.active");
  const activate = useActivateProgramAction();
  const label = t("startDay", { name: dayName });
  if (disabled || !dayId) {
    return (
      <div className="mt-4">
        <Button type="button" size="lg" disabled aria-describedby="start-day-hint" className="w-full">
          <Play className="size-4 fill-current" aria-hidden />
          {label}
        </Button>
        <p id="start-day-hint" className="mt-2 text-center text-xs text-muted-foreground">
          {hint ?? t("saveFirst")}
        </p>
      </div>
    );
  }
  return (
    <StartWorkoutForm
      dayId={dayId}
      className="mt-4"
      onStart={
        program
          ? () =>
              // Toaster — у кореневому layout, тож toast лишається і на екрані тренування.
              toast(ta("trainingOther", { name: program.name }), {
                duration: 12_000,
                action: { label: ta("yes"), onClick: () => void activate(program) },
              })
          : undefined
      }
    >
      <PendingButton size="lg" className="w-full">
        <Play className="size-4 fill-current" aria-hidden />
        {label}
      </PendingButton>
    </StartWorkoutForm>
  );
}

/** Шаблон (лише перегляд): опис мовою інтерфейсу і зведення кожного дня. */
function TemplateOverview({
  description,
  days,
}: {
  description: string | null;
  days: ProgramEditorData["draft"]["days"];
}) {
  const t = useTranslations("programs.template");
  const te = useTranslations("programs.editor");
  const minRest = useMinRest();
  const transitionRest = useTransitionRestEnabled();
  return (
    <section aria-labelledby="template-about" className="mt-5 rounded-2xl border border-foreground/10 bg-card p-4">
      <h2 id="template-about" className="font-heading text-base font-bold">
        {t("about")}
      </h2>
      {description && <p className="mt-1 text-sm text-foreground/85">{description}</p>}
      <h3 className="mt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("overview")}</h3>
      <ul className="mt-1.5 space-y-1">
        {days.map((d) => (
          <li key={d.key} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-semibold">{d.name || te("untitled")}</span>
            <span className="text-muted-foreground">{te("daySummary", dayStats(d.exercises, minRest, transitionRest))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Outline-pill «Зробити активною» у шапці редактора. */
function MakeActiveButton({ onClick, pending, className }: { onClick: () => void; pending: boolean; className?: string }) {
  const t = useTranslations("programs.active");
  return (
    <Button
      type="button"
      variant="outline-pill"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {t("makeActive")}
    </Button>
  );
}
