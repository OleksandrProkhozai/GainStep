"use client";

import { useId, useState, useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/programs/responsive-modal";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/components/i18n/use-error-text";
import { createExercise, updateExercise } from "@/lib/exercises/actions";
import {
  DEFAULT_STEP_KG,
  EQUIPMENT,
  exerciseFormSchema,
  minStepKg,
  MUSCLE_GROUPS,
  type Equipment,
  type LibraryExercise,
  type MuscleGroup,
} from "@/lib/exercises/catalog";
import { useUnit } from "@/components/preferences/preferences-provider";
import { ImagePicker } from "@/components/images/image-picker";
import { useImageDraft } from "@/components/images/use-image-draft";
import { EXERCISE_IMAGES_BUCKET } from "@/lib/exercises/images";
import { ExerciseThumb } from "./exercise-thumb";
import { formatWeightValue, inputToKg, toInputWeight, unitLabel, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

const field =
  "h-12 w-full rounded-full border border-line bg-background/70 px-5 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20";

/**
 * Створення / редагування власної вправи. Крок ваги вводиться в одиницях
 * користувача, у базу йде в кг (fromDisplayWeight на сервері).
 * Десктоп — Dialog, телефон — нижній лист.
 */
export function ExerciseFormDialog({
  open,
  onOpenChange,
  exercise,
  initialName = "",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Вправа для редагування; без неї — створення. */
  exercise?: LibraryExercise;
  initialName?: string;
  onSaved?: (exercise: LibraryExercise) => void;
}) {
  const unit = useUnit();
  const t = useTranslations("exercises.form");
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={exercise ? t("editTitle") : t("createTitle")}
      description={exercise ? t("editDescription") : t("createDescription")}
    >
      {/* Форма монтується при кожному відкритті — стан щоразу свіжий. */}
      {open && (
        <ExerciseForm
          unit={unit}
          exercise={exercise}
          initialName={initialName}
          onDone={(saved) => {
            onSaved?.(saved);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </ResponsiveModal>
  );
}

function ExerciseForm({
  unit,
  exercise,
  initialName,
  onDone,
  onCancel,
}: {
  unit: WeightUnit;
  exercise?: LibraryExercise;
  initialName: string;
  onDone: (exercise: LibraryExercise) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const t = useTranslations("exercises.form");
  const tc = useTranslations("common");
  const tm = useTranslations("common.enums.muscle");
  const tq = useTranslations("common.enums.equipment");
  const locale = useLocale();
  const errorText = useErrorText();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(exercise?.muscleGroup ?? "chest");
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? "barbell");
  // Крок у кг, який зараз показує поле: незмінене поле відправляє саме його
  // (2.5 kg показується як 5.5 lb — без цього збереження дало б 2.49 kg).
  const [stepBaseKg, setStepBaseKg] = useState(exercise?.incrementKg ?? DEFAULT_STEP_KG.barbell);
  const [step, setStep] = useState(() => formatWeightValue(stepBaseKg, unit));
  // Користувач сам змінював крок — обладнання його більше не перезаписує.
  const [stepTouched, setStepTouched] = useState(false);

  const setStepKg = (kg: number) => {
    setStepBaseKg(kg);
    setStep(formatWeightValue(kg, unit));
  };

  /** Крок із поля в кг; для тренажера / блока 11 lb (= 4.99 кг) — це рівно 5 кг. */
  const stepToKg = (eq: Equipment) => {
    const value = Number(step.replace(",", "."));
    const kg = inputToKg(value, unit, stepBaseKg);
    const min = minStepKg(eq);
    return kg < min && value >= toInputWeight(min, unit) ? min : kg;
  };

  const changeEquipment = (eq: Equipment) => {
    setEquipment(eq);
    if (!exercise && !stepTouched) {
      setStepKg(DEFAULT_STEP_KG[eq]);
    } else if (stepToKg(eq) < minStepKg(eq)) {
      setStepKg(minStepKg(eq));
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Фото: null — картинка за замовчуванням; у базу шлях іде лише при збереженні.
  const image = useImageDraft(EXERCISE_IMAGES_BUCKET, exercise?.imagePath ?? null);
  const shownError = error ?? image.error;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Крок відправляємо в кг.
    const stepKg = stepToKg(equipment);
    const input = { name, muscleGroup, equipment, weightStep: stepKg, unit: "kg" as const, imagePath: image.path };
    const parsed = exerciseFormSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "invalidForm");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = exercise ? await updateExercise(exercise.id, parsed.data) : await createExercise(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Збережене фото тепер належить вправі — при закритті форми не прибирати.
      image.commit();
      toast.success(exercise ? t("updated") : t("created"));
      onDone(result.exercise);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <div className="space-y-4 overflow-y-auto px-4 pb-2 lg:px-5">
        <ImagePicker
          preview={<ExerciseThumb exercise={{ muscleGroup, imagePath: image.path, custom: true }} size="lg" />}
          hasImage={image.path !== null}
          uploading={image.uploading}
          onPick={(file) => {
            setError(null);
            void image.pick(file);
          }}
          onReset={image.reset}
        />
        <div>
          <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-medium">
            {t("name")}
          </label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
            autoComplete="off"
            placeholder={t("namePlaceholder")}
            aria-invalid={error !== null && name.trim().length < 2}
            className={field}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-muscle`} className="mb-1.5 block text-sm font-medium">
              {t("muscleGroup")}
            </label>
            <div className="relative">
              <select
                id={`${id}-muscle`}
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                className={cn(field, "appearance-none pr-11")}
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m} className="bg-card">
                    {tm(m)}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-equipment`} className="mb-1.5 block text-sm font-medium">
              {t("equipment")}
            </label>
            <div className="relative">
              <select
                id={`${id}-equipment`}
                value={equipment}
                onChange={(e) => changeEquipment(e.target.value as Equipment)}
                className={cn(field, "appearance-none pr-11")}
              >
                {EQUIPMENT.map((eq) => (
                  <option key={eq} value={eq} className="bg-card">
                    {tq(eq)}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-step`} className="mb-1.5 block text-sm font-medium">
            {t("weightStep")}
          </label>
          <div className="relative">
            <input
              id={`${id}-step`}
              value={step}
              onChange={(e) => {
                const text = e.target.value.replace(",", ".");
                if (/^\d*\.?\d{0,2}$/.test(text)) {
                  setStep(text);
                  setStepTouched(true);
                }
              }}
              inputMode="decimal"
              autoComplete="off"
              aria-describedby={`${id}-step-hint`}
              className={cn(field, "pr-12")}
            />
            <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-sm text-muted-foreground">
              {unitLabel(unit, locale)}
            </span>
          </div>
          <p id={`${id}-step-hint`} className="mt-1.5 text-xs text-muted-foreground">
            {t("weightStepHint")}
          </p>
        </div>
        {shownError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorText(shownError)}
          </p>
        )}
      </div>
      <div className="flex gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:px-5 lg:pb-5">
        <Button type="button" variant="outline-pill" onClick={onCancel} className="flex-1">
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending || image.uploading} aria-busy={pending} className="flex-1">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {exercise ? tc("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
