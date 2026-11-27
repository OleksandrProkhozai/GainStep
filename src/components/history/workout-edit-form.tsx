"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { useErrorText } from "@/components/i18n/use-error-text";
import { useWeightFormat } from "@/components/i18n/use-format";
import { toDayKey, toTimeKey, zonedTimeToISO } from "@/lib/dates";
import { saveWorkoutEdits } from "@/lib/history/actions";
import type { HistoryWorkout } from "@/lib/history/derive";
import {
  NOTES_MAX,
  parseEditDraft,
  type DraftErrors,
  type DraftExercise,
  type EditDraft,
} from "@/lib/history/edit-schema";
import { exerciseName } from "@/lib/i18n/names";
import { formatWeightValue } from "@/lib/units";
import { cn } from "@/lib/utils";
import { durationText } from "./format";

const inputBase =
  "h-11 w-full min-w-0 rounded-xl border border-foreground/12 bg-background px-3 text-[15px] tabular-nums outline-none transition focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

/** Початкова чернетка з тренування (ключі детерміновані — без розбіжностей гідрації). */
function initialDraft(workout: HistoryWorkout, unit: ReturnType<typeof useWeightFormat>["unit"], locale: string): EditDraft {
  return {
    exercises: workout.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s, i) => ({
        key: `${ex.exerciseId}-${i}`,
        weight: formatWeightValue(s.weight, unit, locale),
        reps: String(s.reps),
        isCompleted: s.isCompleted,
        completedAt: s.completedAt ?? null,
        originalKg: s.weight,
      })),
    })),
    notes: workout.notes,
    date: toDayKey(workout.startedAt),
    time: toTimeKey(workout.startedAt),
  };
}

/**
 * Редагування завершеного тренування: вага (в одиницях користувача) і
 * повторення, "виконано", додати/видалити підхід, нотатка, дата й час
 * початку. Тривалість не змінюється. Збереження — RPC save_workout_sets.
 */
export function WorkoutEditForm({ workout, today }: { workout: HistoryWorkout; today: string }) {
  const t = useTranslations("history.edit");
  const tt = useTranslations("history.table");
  const errorText = useErrorText();
  const locale = useLocale();
  const fmt = useWeightFormat();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initial = useMemo(() => initialDraft(workout, fmt.unit, locale), [workout, fmt.unit, locale]);
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const [draft, setDraft] = useState<EditDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const savedRef = useRef(false);
  const counter = useRef(0);

  const dirty = JSON.stringify(draft) !== initialJson;

  // Попередження про незбережені зміни при закритті/оновленні вкладки.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (savedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const updateExercise = (exerciseId: string, fn: (ex: DraftExercise) => DraftExercise) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((ex) => (ex.exerciseId === exerciseId ? fn(ex) : ex)) }));

  const updateSet = (exerciseId: string, key: string, patch: Partial<DraftExercise["sets"][number]>) =>
    updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }));

  const addSet = (exerciseId: string) =>
    updateExercise(exerciseId, (ex) => {
      const last = ex.sets[ex.sets.length - 1];
      counter.current += 1;
      return {
        ...ex,
        sets: [
          ...ex.sets,
          {
            key: `new-${counter.current}`,
            weight: last?.weight ?? "0",
            reps: last?.reps ?? "0",
            isCompleted: true,
            completedAt: null,
            originalKg: last?.originalKg ?? null,
          },
        ],
      };
    });

  const removeSet = (exerciseId: string, key: string) =>
    updateExercise(exerciseId, (ex) => ({ ...ex, sets: ex.sets.filter((s) => s.key !== key) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseEditDraft(draft, fmt.unit);
    const nextErrors: DraftErrors = parsed.ok ? {} : { ...parsed.errors };
    let startedAt: string | null = null;
    if (!nextErrors.date) {
      startedAt = zonedTimeToISO(draft.date, draft.time);
      if (Date.parse(startedAt) > Date.now()) nextErrors.date = "workoutStartFuture";
    }
    setErrors(nextErrors);
    if (!parsed.ok || Object.keys(nextErrors).length > 0 || !startedAt) {
      toast.error(t("invalid"));
      return;
    }
    const value = parsed.value;
    startTransition(async () => {
      const result = await saveWorkoutEdits({ workoutId: workout.id, ...value, startedAt: startedAt! });
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      savedRef.current = true;
      toast.success(t("saved"));
      router.push(`/workouts/${workout.id}`);
    });
  };

  const err = (key: string) => errors[key];

  return (
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-3xl pb-28 md:pb-4">
      <header className="flex items-center gap-3">
        <Link
          href={`/workouts/${workout.id}`}
          aria-label={t("back")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-card transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t("title")}</p>
          <h1 className="line-clamp-2 font-heading text-xl leading-tight font-extrabold tracking-tight md:text-[28px]">{workout.name}</h1>
        </div>
      </header>

      <section className="mt-5 rounded-[20px] border border-foreground/10 bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("date")}
            <input
              type="date"
              required
              max={today}
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              aria-invalid={Boolean(err("date")) || undefined}
              aria-describedby={err("date") ? "date-error" : "duration-note"}
              className={inputBase}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("time")}
            <input
              type="time"
              required
              value={draft.time}
              onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              aria-invalid={Boolean(err("date")) || undefined}
              className={inputBase}
            />
          </label>
        </div>
        {err("date") ? (
          <p id="date-error" className="mt-2 text-sm text-destructive">
            {errorText(err("date"))}
          </p>
        ) : (
          <p id="duration-note" className="mt-2 text-xs text-muted-foreground">
            {t("durationNote", { duration: durationText(workout.stats.durationMinutes, locale) })}
          </p>
        )}
      </section>

      <div className="mt-3 flex flex-col gap-3">
        {draft.exercises.map((ex) => {
          const meta = workout.exercises.find((e) => e.exerciseId === ex.exerciseId)!;
          const name = exerciseName(meta, locale);
          return (
            <fieldset key={ex.exerciseId} className="rounded-[20px] border border-foreground/10 bg-card p-3 md:p-4">
              <legend className="sr-only">{name}</legend>
              <div className="mb-2 flex items-center gap-3">
                <ExerciseThumb exercise={meta} size="sm" />
                <p aria-hidden className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug font-semibold">
                  {name}
                </p>
              </div>

              <div
                aria-hidden
                className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] gap-2 px-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
              >
                <span>{tt("set")}</span>
                <span>{t("weight", { unit: fmt.unitLabel })}</span>
                <span>{t("reps")}</span>
                <span className="text-center">{t("done")}</span>
                <span />
              </div>

              <ul className="flex flex-col gap-1.5">
                {ex.sets.map((s, i) => {
                  const n = i + 1;
                  const label = t("setLabel", { n });
                  const weightErr = err(`${s.key}.weight`);
                  const repsErr = err(`${s.key}.reps`);
                  return (
                    <li key={s.key}>
                      <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-2">
                        <span className="text-center text-sm font-semibold text-muted-foreground tabular-nums">{n}</span>
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          value={s.weight}
                          onChange={(e) => updateSet(ex.exerciseId, s.key, { weight: e.target.value })}
                          aria-label={`${label}: ${t("weight", { unit: fmt.unitLabel })}`}
                          aria-invalid={Boolean(weightErr) || undefined}
                          className={inputBase}
                        />
                        <input
                          inputMode="numeric"
                          autoComplete="off"
                          value={s.reps}
                          onChange={(e) => updateSet(ex.exerciseId, s.key, { reps: e.target.value })}
                          aria-label={`${label}: ${t("reps")}`}
                          aria-invalid={Boolean(repsErr) || undefined}
                          className={inputBase}
                        />
                        <label className="flex size-11 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={s.isCompleted}
                            onChange={(e) =>
                              updateSet(ex.exerciseId, s.key, { isCompleted: e.target.checked })
                            }
                            aria-label={`${label}: ${t("done")}`}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className="flex size-8 items-center justify-center rounded-full border border-foreground/20 text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-primary/40"
                          >
                            <Check className="size-4" strokeWidth={3} />
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeSet(ex.exerciseId, s.key)}
                          disabled={ex.sets.length <= 1}
                          aria-label={t("removeSet", { n })}
                          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                      {(weightErr || repsErr) && (
                        <p role="alert" className="mt-1 pl-10 text-xs text-destructive">
                          {errorText(weightErr ?? repsErr)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {err(`${ex.exerciseId}.sets`) && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errorText(err(`${ex.exerciseId}.sets`))}
                </p>
              )}
              <button
                type="button"
                onClick={() => addSet(ex.exerciseId)}
                className="mt-2 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-accent-text transition hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
              >
                <Plus className="size-4" aria-hidden />
                {t("addSet")}
              </button>
            </fieldset>
          );
        })}

        <label className="flex flex-col gap-1.5 rounded-[20px] border border-foreground/10 bg-card p-4 text-sm font-medium">
          {t("notes")}
          <textarea
            value={draft.notes}
            maxLength={NOTES_MAX}
            rows={3}
            placeholder={t("notesPlaceholder")}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            aria-invalid={Boolean(err("notes")) || undefined}
            className={cn(inputBase, "h-auto min-h-24 resize-y py-2.5 font-normal")}
          />
          {err("notes") && <span className="text-xs text-destructive">{errorText(err("notes"))}</span>}
        </label>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 bg-linear-to-t from-background from-75% to-background/0 px-[max(1rem,env(safe-area-inset-left))] pt-6 pb-3 md:sticky md:bottom-4 md:mt-5 md:bg-none md:p-0">
        <div className="mx-auto flex max-w-3xl gap-2.5 md:justify-end">
          <Link
            href={`/workouts/${workout.id}`}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-foreground/25 bg-background px-6 text-sm font-bold transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none md:flex-none"
          >
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={pending || !dirty}
            aria-busy={pending}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50 md:flex-none"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("save")}
          </button>
        </div>
      </div>
    </form>
  );
}
