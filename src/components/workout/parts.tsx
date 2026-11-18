"use client";

import { useState } from "react";
import {
  Cable,
  Check,
  CloudCheck,
  CloudOff,
  Cog,
  Dumbbell,
  Loader2,
  Minus,
  PersonStanding,
  Plus,
  Timer,
  Trophy,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/lib/progression";
import { clampReps, clampWeightKg, REPS_MAX, WEIGHT_MAX_KG } from "@/lib/workout/derive";
import { formatSuggestionReason } from "@/lib/workout/suggestion-text";
import type { Equipment, MuscleGroup, WorkoutExercise } from "@/lib/workout/types";
import {
  formatWeight,
  formatWeightValue,
  fromDisplayWeight,
  kgToUnit,
  toInputWeight,
  weightStep,
  type WeightUnit,
} from "@/lib/units";
import type { SetResult } from "@/lib/progression";
import { useWorkout } from "./context";
import { formatElapsed, useNow } from "./hooks";

// ───────────── Іконки й теги ─────────────

const EQUIPMENT_ICON: Record<Equipment, { icon: LucideIcon; className?: string }> = {
  barbell: { icon: Dumbbell },
  dumbbell: { icon: Dumbbell, className: "-rotate-45" },
  machine: { icon: Cog },
  cable: { icon: Cable },
  bodyweight: { icon: PersonStanding },
  kettlebell: { icon: Weight },
};

export function ExerciseIcon({ equipment, className }: { equipment: Equipment; className?: string }) {
  const { icon: Icon, className: rotate } = EQUIPMENT_ICON[equipment];
  return <Icon className={cn("size-6 shrink-0 text-foreground/85", rotate, className)} aria-hidden />;
}

const label = (value: MuscleGroup | Equipment) => value.charAt(0).toUpperCase() + value.slice(1);

export function ExerciseTags({ exercise, className }: { exercise: WorkoutExercise; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {[exercise.muscleGroup, exercise.equipment].map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-white/15 px-3.5 py-1 text-sm font-medium text-foreground/90"
        >
          {label(tag)}
        </span>
      ))}
    </div>
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
  unit,
  className,
}: {
  exercise: WorkoutExercise;
  suggestion: Suggestion;
  unit: WeightUnit;
  className?: string;
}) {
  const weight = suggestion.weight === null ? null : formatWeight(suggestion.weight, unit);
  let text: string;
  let tone: string;
  switch (suggestion.action) {
    case "increase":
      text = `Suggested: ${weight} ↑ +${formatWeight(suggestion.delta, unit)}`;
      tone = "bg-primary text-primary-foreground";
      break;
    case "deload":
      text = `Suggested: ${weight} ↓ −10%`;
      tone = "bg-orange-400 text-[#1a0f00]";
      break;
    case "same":
      text = `Suggested: ${weight} = same`;
      tone = "bg-white/10 text-foreground";
      break;
    default:
      text = formatSuggestionReason(suggestion, exercise, unit);
      tone = "bg-white/10 text-foreground";
  }

  // Для 'none' пояснення вже на самій плашці.
  const reason =
    suggestion.action === "none" ? null : formatSuggestionReason(suggestion, exercise, unit);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p
        className={cn(
          "inline-flex min-h-11 w-fit max-w-full items-center rounded-full px-5 py-2 text-[15px] font-bold lg:text-base",
          tone,
        )}
      >
        {text}
      </p>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
    </div>
  );
}

// ───────────── Шапка: годинник і статус збереження ─────────────

export function WorkoutClock({ startedAt, className }: { startedAt: number; className?: string }) {
  const now = useNow(1000);
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading font-extrabold tabular-nums", className)}>
      <Timer className="size-[0.9em] shrink-0" strokeWidth={2.25} aria-hidden />
      <span>{formatElapsed(now - startedAt)}</span>
      <span className="sr-only">workout duration</span>
    </span>
  );
}

export function SaveStatus({ className }: { className?: string }) {
  const status = useWorkout((s) => s.syncStatus);
  const config = {
    saved: { icon: CloudCheck, text: "Saved", cls: "text-muted-foreground" },
    saving: { icon: Loader2, text: "Saving…", cls: "text-muted-foreground" },
    offline: { icon: CloudOff, text: "Offline · will sync", cls: "text-orange-300" },
  }[status];
  const Icon = config.icon;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-sm whitespace-nowrap", config.cls, className)}
    >
      <Icon className={cn("size-5", status === "saving" && "animate-spin")} aria-hidden />
      {config.text}
    </span>
  );
}

// ───────────── Підходи ─────────────

export function PrBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md border border-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-300",
        className,
      )}
    >
      <Trophy className="size-3" aria-hidden />
      PR
    </span>
  );
}

/** "60 × 12" або "—". */
export function formatSetResult(set: SetResult | null, unit: WeightUnit) {
  if (!set) return "—";
  return `${formatWeightValue(set.weight, unit)} × ${set.reps}`;
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
          : "border-2 border-white/35 text-transparent hover:border-primary/70",
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
          className={cn("size-1.5 rounded-full", i < done ? "bg-primary" : "bg-white/30")}
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
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const nudge = (dir: 1 | -1) => {
    const base = value ?? (dir > 0 ? 0 : step);
    // Прибираємо хвости float: 0.1 + 0.2 → 0.3
    const next = Math.round((base + dir * step) * 100) / 100;
    onChange(clamp(next));
  };
  const lg = size === "lg";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center rounded-xl bg-black/35 ring-1 ring-white/5",
        lg ? "h-14 w-full" : "h-10",
      )}
    >
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label={`Decrease ${label}`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl text-foreground/90 transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-95",
          lg ? "size-12" : "size-8 xl:size-9",
        )}
      >
        <Minus className={lg ? "size-5" : "size-4"} aria-hidden />
      </button>
      <input
        aria-label={label}
        inputMode={integer ? "numeric" : "decimal"}
        enterKeyHint="done"
        autoComplete="off"
        value={draft ?? (value === null ? "" : String(value))}
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
          "h-full min-w-0 flex-1 bg-transparent text-center font-bold tabular-nums outline-none placeholder:text-muted-foreground focus:bg-white/5",
          lg ? "text-2xl" : "w-11 text-base xl:w-14",
        )}
      />
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label={`Increase ${label}`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl text-foreground/90 transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-95",
          lg ? "size-12" : "size-8 xl:size-9",
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
  return (
    <Stepper
      value={weightKg === null ? null : toInputWeight(weightKg, unit)}
      step={weightStep(incrementKg, unit)}
      min={0}
      max={Math.floor(kgToUnit(WEIGHT_MAX_KG, unit))}
      onChange={(v) => onChange(clampWeightKg(fromDisplayWeight(v, unit)))}
      size={size}
      label={`weight, ${unit}`}
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
  return (
    <Stepper
      value={reps}
      step={1}
      min={0}
      max={REPS_MAX}
      integer
      onChange={(v) => onChange(clampReps(v))}
      size={size}
      label="reps"
    />
  );
}
