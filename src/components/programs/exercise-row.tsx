"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, Minus, Plus, Trash2 } from "lucide-react";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { useLocale, useTranslations } from "next-intl";
import { useWeightFormat } from "@/components/i18n/use-format";
import { useMinRest } from "@/components/preferences/preferences-provider";
import { Button } from "@/components/ui/button";
import { exerciseName } from "@/lib/i18n/names";
import { formatRest, formatScheme, type DraftExercise } from "@/lib/programs/draft";
import type { NextChip as NextChipData } from "@/lib/programs/next";
import { PROGRAM_LIMITS as L } from "@/lib/programs/schema";
import { cn } from "@/lib/utils";
import {
  autoTransitionRest,
  effectiveRest,
  isRaisedByMin,
  stepTransitionRest,
  TRANSITION_REST,
} from "@/lib/workout/rest";

// ───────────── Чип Next ─────────────

const CHIP_TONE: Record<NextChipData["action"], string> = {
  increase: "bg-primary text-primary-foreground",
  same: "bg-foreground/10 text-foreground",
  deload: "bg-[#FF9F43] text-[#1a0f00]",
  none: "border border-line bg-transparent text-muted-foreground",
  bodyweight: "bg-muted text-foreground/80",
};

// "same" — без значка: підпис "Залишити вагу" і так це каже.
const ARROW = { increase: "↑", same: "", deload: "↓" } as const;

/**
 * Чип рекомендації: два рядки (вага 14px + підпис 11px), мін. ширина 120px,
 * обидва рядки по центру.
 * Повний текст ("Next time: 62.5 kg") — у title і для скрінрідерів.
 */
export function NextChip({ chip, className }: { chip: NextChipData; className?: string }) {
  const t = useTranslations("programs.next");
  const fmt = useWeightFormat();
  const withWeight = chip.action === "increase" || chip.action === "same" || chip.action === "deload";
  const weight = chip.weightKg === null ? "" : fmt.weight(chip.weightKg);
  const label = withWeight
    ? t("label", { weight, arrow: ARROW[chip.action as keyof typeof ARROW] }).trim()
    : chip.action === "bodyweight"
      ? t("bodyweight")
      : t("none");
  const caption =
    chip.action === "increase"
      ? t("caption.increase")
      : chip.action === "same"
        ? t("caption.same")
        : chip.action === "deload"
          ? t("caption.deload")
          : null;
  return (
    <span
      title={withWeight ? t("full", { weight }) : undefined}
      className={cn(
        "inline-flex min-h-11 min-w-[120px] shrink-0 items-center justify-center rounded-2xl px-3 py-1.5 leading-tight",
        CHIP_TONE[chip.action],
        className,
      )}
    >
      {/* Обидва рядки — по центру чипа. */}
      <span className="flex flex-col items-center text-center">
        <span
          className={cn(
            "whitespace-nowrap tabular-nums",
            chip.action === "none" || chip.action === "bodyweight" ? "text-[13px] font-semibold" : "text-sm font-bold",
          )}
        >
          {withWeight && <span className="sr-only">{t("full", { weight })}. </span>}
          <span aria-hidden={withWeight || undefined}>{label}</span>
        </span>
        {caption && <span className="text-[11px] font-medium whitespace-nowrap opacity-80">{caption}</span>}
      </span>
    </span>
  );
}

/** Маленька пігулка метрики: "3 × 5–8", "Rest 3:00" / "Відпочинок 3:00". */
function MetricChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-muted px-2.5 text-[13px] font-medium whitespace-nowrap text-foreground/80 tabular-nums">
      {children}
    </span>
  );
}

// ───────────── Степер ─────────────

export function Stepper({
  label,
  value,
  display,
  muted,
  onDecrement,
  onIncrement,
  canDecrement,
  canIncrement,
}: {
  label: string;
  value: number;
  display?: string;
  /** Сіре значення (наприклад, "Авто · 5:00"). */
  muted?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement: boolean;
  canIncrement: boolean;
}) {
  const t = useTranslations("programs.row");
  const btn =
    "flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/6 text-foreground/90 transition hover:bg-foreground/12 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-95 disabled:pointer-events-none disabled:opacity-30 lg:size-9";
  return (
    <div className="min-w-0">
      <p className="mb-1 text-center text-xs text-muted-foreground">{label}</p>
      <div role="group" aria-label={label} className="flex items-center gap-1 rounded-full bg-background/70 p-0.5 ring-1 ring-foreground/5">
        <button type="button" onClick={onDecrement} disabled={!canDecrement} aria-label={t("decrease", { label: label.toLocaleLowerCase() })} className={btn}>
          <Minus className="size-4" aria-hidden />
        </button>
        <output
          aria-live="polite"
          className={cn(
            "min-w-8 flex-1 text-center text-[15px] font-bold whitespace-nowrap tabular-nums",
            muted && "font-semibold text-muted-foreground",
          )}
        >
          {display ?? value}
        </output>
        <button type="button" onClick={onIncrement} disabled={!canIncrement} aria-label={t("increase", { label: label.toLocaleLowerCase() })} className={btn}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

type Patch = Partial<Pick<DraftExercise, "targetSets" | "repMin" | "repMax" | "restSeconds" | "transitionRestSeconds">>;

// ───────────── Рядок вправи ─────────────

/**
 * Рядок вправи дня — сітка з фіксованими колонками (gap 12px, px 16 / py 12):
 *   [ручка 20px] [плитка 48px] [назва / група / метрики  1fr] [Next auto]
 * Ручка завжди займає свої 20px, тож колонки однакові в усіх рядках.
 * На телефоні (<640px) Next переходить під метрики, праворуч.
 * Клік розгортає степери. У режимі шаблону (лише перегляд) колонки ручки немає.
 */
export function ExerciseRow({
  exercise,
  chip,
  expanded,
  readOnly,
  onToggle,
  onChange,
  onRemove,
}: {
  exercise: DraftExercise;
  chip: NextChipData;
  expanded: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onChange: (patch: Patch) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.key,
    disabled: readOnly,
  });
  const t = useTranslations("programs.row");
  const tm = useTranslations("common.enums.muscle");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const panelId = `row-${exercise.key}-panel`;
  const e = exercise;
  const showWeightStep = chip.action !== "bodyweight";
  // Відпочинок з урахуванням мінімуму з Settings; rest_seconds у чернетці не змінюється,
  // доки користувач сам не натисне степер.
  const minRest = useMinRest();
  const rest = effectiveRest(e.restSeconds, minRest);
  const raised = isRaisedByMin(e.restSeconds, minRest);
  const restFloor = Math.max(L.restMin, minRest);
  // Відпочинок після вправи: null — "Авто" (5:00 базова / 3:00 ізолююча).
  const autoTransition = autoTransitionRest(e);
  const ownTransition = e.transitionRestSeconds;
  const transitionValue = ownTransition ?? autoTransition;

  // Плитка + текст + Next: на sm+ — один рядок, на телефоні Next під метриками.
  const body = (
    <>
      <ExerciseThumb exercise={e} className="size-12 rounded-xl [grid-area:thumb]" />
      <span className="flex min-w-0 flex-col items-start [grid-area:text]">
        <span className="line-clamp-2 text-base leading-snug font-semibold">{exerciseName(e, locale)}</span>
        <span className="mt-0.5 block max-w-full truncate text-[13px] leading-tight text-muted-foreground">
          {tm(e.muscleGroup)}
        </span>
        <span className="mt-2 flex min-w-0 flex-wrap gap-1.5">
          <MetricChip>{formatScheme(e)}</MetricChip>
          <MetricChip>
            {t("rest", { time: formatRest(rest) })}
            {raised && (
              <span title={t("minRestTooltip")} className="ml-1 inline-flex text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                <span className="sr-only">{t("minRestTooltip")}</span>
              </span>
            )}
          </MetricChip>
        </span>
      </span>
      <NextChip chip={chip} className="self-center justify-self-end [grid-area:next]" />
    </>
  );
  const bodyGrid =
    "grid min-w-0 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 text-left [grid-template-areas:'thumb_text_text'_'._next_next'] sm:[grid-template-areas:'thumb_text_next']";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row relative rounded-2xl border bg-card transition-colors",
        expanded ? "border-foreground/20 bg-foreground/[0.035]" : "border-foreground/8 hover:border-foreground/15",
        isDragging && "z-10 shadow-2xl ring-1 ring-primary/40",
      )}
    >
      {readOnly ? (
        <div className={cn(bodyGrid, "px-4 py-3")}>{body}</div>
      ) : (
        <div className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={t("reorder", { name: exerciseName(e, locale) })}
            className={cn(
              "flex h-11 w-5 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-opacity hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:cursor-grabbing",
              // Миша: ручка приглушена (40%), на hover / фокусі рядка — 100%; тач — завжди 100%.
              "pointer-fine:opacity-40 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100",
              isDragging && "opacity-100",
            )}
          >
            <GripVertical className="size-4.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className={cn(
              bodyGrid,
              "-my-1 rounded-xl py-1 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
            )}
          >
            {body}
          </button>
        </div>
      )}

      {expanded && !readOnly && (
        <div id={panelId} className="border-t border-foreground/8 px-4 pt-3 pb-3.5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stepper
              label={t("sets")}
              value={e.targetSets}
              canDecrement={e.targetSets > L.setsMin}
              canIncrement={e.targetSets < L.setsMax}
              onDecrement={() => onChange({ targetSets: e.targetSets - 1 })}
              onIncrement={() => onChange({ targetSets: e.targetSets + 1 })}
            />
            <Stepper
              label={t("restLabel")}
              value={rest}
              display={formatRest(rest)}
              canDecrement={rest > restFloor}
              canIncrement={rest < L.restMax}
              onDecrement={() => onChange({ restSeconds: Math.max(restFloor, rest - L.restStep) })}
              onIncrement={() => onChange({ restSeconds: rest + L.restStep })}
            />
            <Stepper
              label={t("minReps")}
              value={e.repMin}
              canDecrement={e.repMin > L.repsMin}
              canIncrement={e.repMin < e.repMax}
              onDecrement={() => onChange({ repMin: e.repMin - 1 })}
              onIncrement={() => onChange({ repMin: e.repMin + 1 })}
            />
            <Stepper
              label={t("maxReps")}
              value={e.repMax}
              canDecrement={e.repMax > e.repMin}
              canIncrement={e.repMax < L.repsMax}
              onDecrement={() => onChange({ repMax: e.repMax - 1 })}
              onIncrement={() => onChange({ repMax: e.repMax + 1 })}
            />
          </div>
          <div className="mt-3 grid gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="sm:max-w-[240px]">
              <Stepper
                label={t("transitionRest")}
                value={transitionValue}
                display={ownTransition === null ? t("transitionAuto", { time: formatRest(autoTransition) }) : formatRest(ownTransition)}
                muted={ownTransition === null}
                canDecrement={transitionValue > TRANSITION_REST.min}
                canIncrement={transitionValue < TRANSITION_REST.max}
                onDecrement={() => onChange({ transitionRestSeconds: stepTransitionRest(transitionValue, -1) })}
                onIncrement={() => onChange({ transitionRestSeconds: stepTransitionRest(transitionValue, 1) })}
              />
            </div>
            {ownTransition !== null && (
              <button
                type="button"
                onClick={() => onChange({ transitionRestSeconds: null })}
                className="h-11 justify-self-start rounded-full px-4 text-sm font-semibold text-accent-text transition hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none sm:justify-self-end"
              >
                {t("transitionReset")}
              </button>
            )}
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("transitionHint")}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {showWeightStep ? (
              <p className="text-[13px] text-muted-foreground">
                {t("weightStep")} <span className="font-semibold text-foreground/80">+{fmt.weight(e.incrementKg)}</span>
              </p>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRemove}
              className="max-sm:w-full"
            >
              <Trash2 aria-hidden />
              {t("remove")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
