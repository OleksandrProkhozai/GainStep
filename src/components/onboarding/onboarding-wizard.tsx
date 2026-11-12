"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  BicepsFlexed,
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  Loader2,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { cn } from "@/lib/utils";
import { bodyWeightStepSchema } from "@/lib/validations/onboarding";
import type { Enums } from "@/types/database.types";
import {
  LevelCard,
  OnboardingShell,
  ProgramCard,
  ProgramTile,
  SegmentedControl,
  StepHeading,
  TOTAL_STEPS,
  handleRadioKeys,
  outlinePillClass,
  primaryPillClass,
  rovingTabIndex,
} from "./onboarding-ui";

export type ProgramTemplate = {
  id: string;
  name: string;
  days_per_week: number;
};

type Unit = Enums<"weight_unit">;
type Experience = Enums<"experience_level">;
type Goal = Enums<"training_goal">;

/** Вибір програми: id шаблону або Custom (без програми). */
const CUSTOM = "custom";

const UNIT_OPTIONS = [
  { value: "kg", label: "kg" },
  { value: "lb", label: "lb" },
] as const;

const GOAL_OPTIONS = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Mass" },
] as const;

const LEVELS = [
  {
    value: "beginner",
    title: "Beginner",
    description: "Up to 1 year of training",
    icon: BicepsFlexed,
  },
  {
    value: "intermediate",
    title: "Intermediate",
    description: "1+ years of training",
    icon: ChartNoAxesColumnIncreasing,
  },
] as const;

/**
 * Онбординг з одним спільним станом і двома розмітками:
 * - нижче lg (<1024px) — 3 кроки з Back/Next;
 * - lg і ширше — усе на одному екрані.
 * Обидві розмітки є в DOM і перемикаються лише CSS (без миготіння після
 * гідрації), тож зміна ширини вікна нічого не скидає.
 */
export function OnboardingWizard({
  templates,
}: {
  templates: ProgramTemplate[];
}) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Стан усіх розділів живе тут, тож ні Back, ні зміна ширини нічого не скидають.
  const [weight, setWeight] = useState("");
  const [weightTouched, setWeightTouched] = useState(false);
  const [unit, setUnit] = useState<Unit>("kg");
  const [experience, setExperience] = useState<Experience | null>(null);
  const [goal, setGoal] = useState<Goal>("strength");
  const [program, setProgram] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  const weightCheck = bodyWeightStepSchema.safeParse({ weight, unit });
  const weightError =
    weightTouched && !weightCheck.success
      ? weightCheck.error.issues[0]?.message
      : undefined;

  // Розділи для десктопного степера; kg і Strength мають значення за замовчуванням.
  const completed = [
    weightCheck.success,
    experience !== null,
    program !== null,
  ].filter(Boolean).length;
  const allComplete = completed === TOTAL_STEPS;

  const stepValid =
    step === 1
      ? weightCheck.success
      : step === 2
        ? experience !== null
        : program !== null;

  const programOptions = [
    ...templates.map((t) => ({
      id: t.id,
      title: t.name,
      description: `${t.days_per_week} days/week`,
      icon: Dumbbell,
    })),
    {
      id: CUSTOM,
      title: "Custom",
      description: "I'll set it up later",
      icon: Settings,
    },
  ];

  // Після зміни кроку переводимо фокус на заголовок (для скрінрідерів і клавіатури).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function goTo(next: number) {
    setDirection(next > step ? "forward" : "back");
    setStep(next);
  }

  function changeUnit(value: Unit) {
    setUnit(value);
    if (weight) setWeightTouched(true);
  }

  function save() {
    if (!weightCheck.success || !experience || !program || pending) return;
    startTransition(async () => {
      const result = await completeOnboarding({
        weight,
        unit,
        experience,
        goal,
        templateId: program === CUSTOM ? null : program,
        today: format(new Date(), "yyyy-MM-dd"),
      });
      // Успіх завершується редіректом; сюди доходимо лише з помилкою.
      if (result?.error) toast.error(result.error);
    });
  }

  function handleStepSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) setWeightTouched(true);
    if (!stepValid || pending) return;
    if (step < TOTAL_STEPS) goTo(step + 1);
    else save();
  }

  const weightFieldProps = {
    value: weight,
    unit,
    error: weightError,
    onChange: setWeight,
    onBlur: () => weight && setWeightTouched(true),
  };

  const isLast = step === TOTAL_STEPS;

  return (
    <OnboardingShell step={step} completed={completed}>
      {/* ---------- Нижче lg: 3 кроки ---------- */}
      <form
        onSubmit={handleStepSubmit}
        noValidate
        className="mt-8 flex flex-1 flex-col md:mt-10 lg:hidden"
      >
        <fieldset disabled={pending} className="contents">
          <div
            key={step}
            className={cn(
              "animate-in duration-300 ease-out fade-in motion-reduce:animate-none",
              direction === "forward"
                ? "slide-in-from-right-6"
                : "slide-in-from-left-6",
            )}
          >
            {step === 1 && (
              <>
                <StepHeading
                  ref={headingRef}
                  title="Tell us about you"
                  subtitle="We'll use it to track your progress."
                />
                <div className="md:max-w-md">
                  <div className="rounded-3xl border border-white/10 bg-secondary/40 p-4 md:p-5">
                    <Label
                      htmlFor="body-weight"
                      className="pl-1 text-[15px] font-medium text-foreground"
                    >
                      Body weight
                    </Label>
                    <WeightField
                      id="body-weight"
                      className="mt-3"
                      inputClassName="text-3xl md:text-3xl"
                      {...weightFieldProps}
                    />
                  </div>
                  <SegmentedControl
                    aria-label="Weight unit"
                    value={unit}
                    options={UNIT_OPTIONS}
                    onChange={changeUnit}
                    className="mt-4"
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <StepHeading
                  ref={headingRef}
                  title="What's your level?"
                  subtitle="Help us set up the best experience for you."
                />
                <div className="md:grid md:grid-cols-[minmax(0,1.35fr)_1px_minmax(0,1fr)] md:gap-10">
                  <LevelGroup
                    label="Training experience"
                    value={experience}
                    onChange={setExperience}
                  />

                  <span aria-hidden className="hidden bg-white/10 md:block" />

                  <div className="mt-8 md:mt-0">
                    <h2
                      id="training-focus"
                      className="mb-3 font-heading text-xl font-bold text-foreground md:text-2xl"
                    >
                      Training focus?
                    </h2>
                    <SegmentedControl
                      aria-labelledby="training-focus"
                      value={goal}
                      options={GOAL_OPTIONS}
                      onChange={setGoal}
                    />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <StepHeading ref={headingRef} title="Choose a starter program." />
                <div
                  role="radiogroup"
                  aria-label="Starter program"
                  onKeyDown={handleRadioKeys}
                  className="grid gap-3 md:grid-cols-2 md:gap-4"
                >
                  {programOptions.map((item, index) => (
                    <ProgramCard
                      key={item.id}
                      icon={item.icon}
                      title={item.title}
                      description={item.description}
                      selected={program === item.id}
                      tabIndex={rovingTabIndex(
                        program === item.id,
                        index,
                        program !== null,
                      )}
                      onSelect={() => setProgram(item.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div
            className={cn(
              "mt-auto flex gap-3 pt-8 md:pt-10",
              step === 1 ? "md:justify-end" : "md:justify-between",
            )}
          >
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => goTo(step - 1)}
                className={cn(outlinePillClass, "flex-1 md:w-40 md:flex-none")}
              >
                Back
              </Button>
            )}
            <Button
              type="submit"
              disabled={!stepValid || pending}
              aria-busy={pending}
              className={cn(primaryPillClass, "flex-1 md:w-44 md:flex-none")}
            >
              {isLast ? "Let's go" : "Next"}
              <SubmitIcon pending={pending} />
            </Button>
          </div>
        </fieldset>
      </form>

      {/* ---------- lg і ширше: усе на одному екрані ---------- */}
      <fieldset
        disabled={pending}
        className="mt-7 hidden min-w-0 flex-col lg:flex"
      >
        <div className="grid grid-cols-[minmax(0,1.25fr)_1px_minmax(0,1fr)] gap-10">
          <section>
            <h1 className="font-heading text-[30px] leading-tight font-extrabold tracking-tight text-foreground">
              What&apos;s your level?
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Help us set up the best experience for you
            </p>
            <LevelGroup
              label="Training experience"
              value={experience}
              onChange={setExperience}
              className="mt-5 gap-4"
              cardClassName="lg:h-[150px] lg:min-h-0 lg:py-4"
            />
          </section>

          <span aria-hidden className="bg-white/10" />

          <div className="space-y-4">
            <div>
              <Label htmlFor="body-weight-lg" className={desktopLabelClass}>
                Body weight
              </Label>
              <WeightField
                id="body-weight-lg"
                inputClassName="text-2xl md:text-2xl"
                {...weightFieldProps}
              />
            </div>
            <div>
              <h2 id="unit-system-lg" className={desktopLabelClass}>
                Unit system?
              </h2>
              <SegmentedControl
                aria-labelledby="unit-system-lg"
                value={unit}
                options={UNIT_OPTIONS}
                onChange={changeUnit}
                className="h-12"
              />
            </div>
            <div>
              <h2 id="training-focus-lg" className={desktopLabelClass}>
                Training focus?
              </h2>
              <SegmentedControl
                aria-labelledby="training-focus-lg"
                value={goal}
                options={GOAL_OPTIONS}
                onChange={setGoal}
                className="h-12"
              />
            </div>
          </div>
        </div>

        <section className="mt-6">
          <h2 id="starter-program-lg" className={desktopLabelClass}>
            Choose a starter program:
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="starter-program-lg"
            onKeyDown={handleRadioKeys}
            className="grid grid-cols-4 gap-4"
          >
            {programOptions.map((item, index) => (
              <ProgramTile
                key={item.id}
                icon={item.icon}
                title={item.title}
                description={item.description}
                selected={program === item.id}
                tabIndex={rovingTabIndex(
                  program === item.id,
                  index,
                  program !== null,
                )}
                onSelect={() => setProgram(item.id)}
              />
            ))}
          </div>
        </section>

        <div className="mt-6 flex items-center justify-end gap-5">
          {!allComplete && (
            <p id="complete-hint-lg" className="text-sm text-muted-foreground">
              Complete all sections to continue
            </p>
          )}
          <Button
            type="button"
            onClick={save}
            disabled={!allComplete || pending}
            aria-busy={pending}
            aria-describedby={allComplete ? undefined : "complete-hint-lg"}
            className={cn(primaryPillClass, "w-44")}
          >
            Let&apos;s go
            <SubmitIcon pending={pending} />
          </Button>
        </div>
      </fieldset>
    </OnboardingShell>
  );
}

const desktopLabelClass =
  "mb-2 block font-heading text-lg font-bold text-foreground";

function SubmitIcon({ pending }: { pending: boolean }) {
  return pending ? (
    <Loader2 className="animate-spin" aria-hidden />
  ) : (
    <ArrowRight aria-hidden />
  );
}

/** Картки Beginner / Intermediate як radiogroup. */
function LevelGroup({
  label,
  value,
  onChange,
  className,
  cardClassName,
}: {
  label: string;
  value: Experience | null;
  onChange: (value: Experience) => void;
  className?: string;
  cardClassName?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleRadioKeys}
      className={cn("grid grid-cols-2 gap-3 md:gap-4", className)}
    >
      {LEVELS.map((level, index) => (
        <LevelCard
          key={level.value}
          icon={level.icon}
          title={level.title}
          description={level.description}
          selected={value === level.value}
          tabIndex={rovingTabIndex(value === level.value, index, value !== null)}
          onSelect={() => onChange(level.value)}
          className={cardClassName}
        />
      ))}
    </div>
  );
}

/** Поле-пігулка ваги з суфіксом одиниць і помилкою під ним. */
function WeightField({
  id,
  value,
  unit,
  error,
  onChange,
  onBlur,
  className,
  inputClassName,
}: {
  id: string;
  value: string;
  unit: Unit;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  className?: string;
  inputClassName?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <div className="relative">
        <Input
          id={id}
          name="weight"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          placeholder={unit === "kg" ? "75" : "165"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-14 rounded-full border-white/10 bg-background/60 pr-16 pl-6 font-bold text-foreground placeholder:text-foreground/25 focus-visible:border-primary focus-visible:ring-primary/20 dark:bg-background/60",
            inputClassName,
          )}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-lg font-medium text-muted-foreground"
        >
          {unit}
        </span>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 pl-6 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
