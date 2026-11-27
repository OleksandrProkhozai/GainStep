"use client";

import { useState } from "react";
import {
  Check,
  CloudCheck,
  CloudOff,
  Loader2,
  Minus,
  Plus,
  Timer,
  Trophy,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useWeightFormat } from "@/components/i18n/use-format";
import { WhyWeight } from "@/components/progression/why-weight";
import { cn } from "@/lib/utils";
import { isPureBodyweight, type Suggestion } from "@/lib/progression";
import { explainSuggestion } from "@/lib/progression-explain";
import { clampReps, clampWeightKg, progressionInput, REPS_MAX, WEIGHT_MAX_KG } from "@/lib/workout/derive";
import { suggestionReason } from "@/lib/workout/suggestion-text";
import type { Equipment, MuscleGroup, WorkoutExercise } from "@/lib/workout/types";
import {
  formatWeightValue,
  fromDisplayWeight,
  unitLabel,
  kgToUnit,
  toInputWeight,
  weightStep,
  type WeightUnit,
} from "@/lib/units";
import type { SetResult } from "@/lib/progression";
import { useScreen, useWorkout } from "./context";
import { formatElapsed, useNow } from "./hooks";

// ───────────── Теги ─────────────

export function ExerciseTags({ exercise, className }: { exercise: WorkoutExercise; className?: string }) {
  const tm = useTranslations("common.enums.muscle");
  const tq = useTranslations("common.enums.equipment");
  const label = (value: MuscleGroup | Equipment) =>
    value === exercise.muscleGroup ? tm(value as MuscleGroup) : tq(value as Equipment);
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {exercise.source === "added" && <AddedBadge className="px-3.5 py-1 text-sm" />}
      {[exercise.muscleGroup, exercise.equipment].map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-foreground/15 px-3.5 py-1 text-sm font-medium text-foreground/90"
        >
          {label(tag)}
        </span>
      ))}
    </div>
  );
}

/** Маленький бейдж "Додано" — вправа додана під час тренування. */
export function AddedBadge({ className }: { className?: string }) {
  const t = useTranslations("workout");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-accent-text",
        className,
      )}
    >
      {t("addedBadge")}
    </span>
  );
}

// ───────────── Плашка підказки ─────────────

/**
 * Плашка рекомендації алгоритму: increase — лаймова, same — сіра,
 * deload — помаранчева, none — сіра без ваги.
 */
export function SuggestionBanner({
  exercise,
  suggestion,
  className,
}: {
  exercise: WorkoutExercise;
  suggestion: Suggestion;
  className?: string;
}) {
  const t = useTranslations("workout.suggestion");
  const ts = useTranslations("common.suggestion");
  const tr = useTranslations("common.suggestion.reason");
  const fmt = useWeightFormat();
  const locale = useLocale();
  const { unit } = useScreen();
  const weight = suggestion.weight === null ? "" : fmt.weight(suggestion.weight);
  const r = suggestionReason(suggestion, exercise);
  // "Чому така вага?" — з того самого входу, що отримав алгоритм.
  const why = explainSuggestion({ ...progressionInput(exercise, unit), unit }, suggestion, locale);
  // Вправа з власною вагою: вага не змінюється — прогресія в повтореннях.
  const bodyweight = isPureBodyweight(exercise.equipment, exercise.history);
  let text: string;
  let tone: string;
  let reason: string | null;
  switch (bodyweight ? "bodyweight" : suggestion.action) {
    case "bodyweight":
      text = ts("bodyweight");
      tone = "bg-foreground/10 text-foreground";
      break;
    case "increase":
      text = t("increase", { weight, delta: fmt.weight(suggestion.delta) });
      tone = "bg-primary text-primary-foreground";
      break;
    case "deload":
      text = t("deload", { weight });
      tone = "bg-orange-400 text-[#1a0f00]";
      break;
    case "same":
      text = t("same", { weight });
      tone = "bg-foreground/10 text-foreground";
      break;
    default:
      text = tr(r.key, r.values);
      tone = "bg-foreground/10 text-foreground";
  }

  // Для 'none' пояснення вже на самій плашці.
  if (bodyweight) reason = tr("bodyweight", { repMax: exercise.repMax });
  else reason = suggestion.action === "none" ? null : tr(r.key, r.values);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* "i" — після рядка причини (плашка лишається на всю ширину); без причини — біля плашки. */}
      <div className="flex max-w-full items-center gap-1">
        <p
          className={cn(
            "inline-flex min-h-11 w-fit max-w-full min-w-0 items-center rounded-full px-5 py-2 text-[15px] font-bold lg:text-base",
            tone,
          )}
        >
          {text}
        </p>
        {!reason && <WhyWeight text={why} />}
      </div>
      {reason && (
        <p className="-my-1.5 text-sm text-muted-foreground">
          {reason}
          <WhyWeight text={why} className="ml-0.5 align-middle" />
        </p>
      )}
    </div>
  );
}

// ───────────── Шапка: годинник і статус збереження ─────────────

export function WorkoutClock({ startedAt, className }: { startedAt: number; className?: string }) {
  const t = useTranslations("workout");
  const now = useNow(1000);
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading font-extrabold tabular-nums", className)}>
      <Timer className="size-[0.9em] shrink-0" strokeWidth={2.25} aria-hidden />
      <span>{formatElapsed(now - startedAt)}</span>
      <span className="sr-only">{t("duration")}</span>
    </span>
  );
}

/**
 * Статус збереження. compact — на телефоні лише іконка (текст — у title і
 * для скрінрідера), повний текст від sm, щоб рядок не вилазив за екран.
 */
export function SaveStatus({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("workout.sync");
  const status = useWorkout((s) => s.syncStatus);
  const config = {
    saved: { icon: CloudCheck, text: t("saved"), cls: "text-muted-foreground" },
    saving: { icon: Loader2, text: t("saving"), cls: "text-muted-foreground" },
    offline: { icon: CloudOff, text: t("offline"), cls: "text-orange-300" },
  }[status];
  const Icon = config.icon;
  return (
    <span
      role="status"
      aria-live="polite"
      title={compact ? config.text : undefined}
      className={cn("inline-flex shrink-0 items-center gap-2 text-sm whitespace-nowrap", config.cls, className)}
    >
      <Icon className={cn("size-5 shrink-0", status === "saving" && "animate-spin")} aria-hidden />
      <span className={cn(compact && "max-sm:sr-only")}>{config.text}</span>
    </span>
  );
}

// ───────────── Підходи ─────────────

export function PrBadge({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md border border-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-300",
        className,
      )}
    >
      <Trophy className="size-3" aria-hidden />
      {t("pr")}
    </span>
  );
}

/** "60 × 12" (uk: "62,5 × 12") або "—". */
export function formatSetResult(set: SetResult | null, unit: WeightUnit, locale = "en") {
  if (!set) return "—";
  return `${formatWeightValue(set.weight, unit, locale)} × ${set.reps}`;
}

/** Кругла галочка "Done". */
export function DoneButton({
  done,
  onClick,
  label,
  className,
}: {
  done: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={done}
      aria-label={label}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition focus-visible:ring-3 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-95",
        done
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-2 border-foreground/35 text-transparent hover:border-primary/70",
        className,
      )}
    >
      <Check className="size-5" strokeWidth={3} aria-hidden />
    </button>
  );
}

/** Крапки прогресу підходів у списку вправ. */
export function ProgressDots({ done, total }: { done: number; total: number }) {
  const shown = Math.min(total, 6);
  return (
    <span className="flex shrink-0 gap-1" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={cn("size-1.5 rounded-full", i < done ? "bg-primary" : "bg-foreground/30")}
        />
      ))}
    </span>
  );
}

// ───────────── Степери ─────────────

/**
 * Поле з кнопками − / +. Під час набору з клавіатури тримаємо чернетку
 * (щоб "62." не перетворювалось на 62), а коректні числа одразу
 * передаємо назовні.
 */
function Stepper({
  value,
  step,
  min,
  max,
  integer,
  onChange,
  size,
  label,
}: {
  value: number | null;
  step: number;
  min: number;
  max: number;
  integer?: boolean;
  onChange: (value: number) => void;
  size: "sm" | "lg";
  label: string;
}) {
  const t = useTranslations("workout");
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const nudge = (dir: 1 | -1) => {
    const base = value ?? (dir > 0 ? 0 : step);
    // Прибираємо хвости float: 0.1 + 0.2 → 0.3
    const next = Math.round((base + dir * step) * 100) / 100;
    onChange(clamp(next));
  };
  const lg = size === "lg";
  const shown = draft ?? (value === null ? "" : String(value));
  // Великий степер на телефоні вузький (~140px): довгі значення ("102.5",
  // "1102.5") зменшуємо, щоб число не обрізалося.
  const lgText = shown.length >= 6 ? "text-lg" : shown.length === 5 ? "text-xl" : "text-2xl";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center rounded-full bg-background/70 ring-1 ring-foreground/5",
        lg ? "h-14 w-full" : "h-10",
      )}
    >
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label={t("decrease", { label })}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-foreground/90 transition hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-95",
          lg ? "size-11" : "size-8 xl:size-9",
        )}
      >
        <Minus className={lg ? "size-5" : "size-4"} aria-hidden />
      </button>
      <input
        aria-label={label}
        inputMode={integer ? "numeric" : "decimal"}
        enterKeyHint="done"
        autoComplete="off"
        value={shown}
        placeholder="—"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const text = e.target.value.replace(",", ".");
          if (!/^\d*\.?\d*$/.test(text)) return;
          setDraft(text);
          const parsed = integer ? parseInt(text, 10) : parseFloat(text);
          if (Number.isFinite(parsed)) onChange(clamp(parsed));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent px-0 text-center font-bold tabular-nums outline-none placeholder:text-muted-foreground focus:bg-foreground/5",
          lg ? lgText : "w-11 text-base xl:w-14",
        )}
      />
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label={t("increase", { label })}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-foreground/90 transition hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-95",
          lg ? "size-11" : "size-8 xl:size-9",
        )}
      >
        <Plus className={lg ? "size-5" : "size-4"} aria-hidden />
      </button>
    </div>
  );
}

/** Степер ваги: показує в одиницях користувача, назовні віддає кг. */
export function WeightStepper({
  weightKg,
  incrementKg,
  unit,
  onChange,
  size = "sm",
}: {
  weightKg: number | null;
  incrementKg: number;
  unit: WeightUnit;
  onChange: (kg: number) => void;
  size?: "sm" | "lg";
}) {
  const t = useTranslations("workout");
  const locale = useLocale();
  return (
    <Stepper
      value={weightKg === null ? null : toInputWeight(weightKg, unit)}
      step={weightStep(incrementKg, unit)}
      min={0}
      max={Math.floor(kgToUnit(WEIGHT_MAX_KG, unit))}
      onChange={(v) => onChange(clampWeightKg(fromDisplayWeight(v, unit)))}
      size={size}
      label={t("weightLabel", { unit: unitLabel(unit, locale) })}
    />
  );
}

export function RepsStepper({
  reps,
  onChange,
  size = "sm",
}: {
  reps: number;
  onChange: (reps: number) => void;
  size?: "sm" | "lg";
}) {
  const t = useTranslations("workout");
  return (
    <Stepper
      value={reps}
      step={1}
      min={0}
      max={REPS_MAX}
      integer
      onChange={(v) => onChange(clampReps(v))}
      size={size}
      label={t("repsLabel")}
    />
  );
}
