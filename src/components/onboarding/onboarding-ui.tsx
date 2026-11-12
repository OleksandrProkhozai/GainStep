import { Check, Dumbbell, type LucideIcon } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export const TOTAL_STEPS = 3;

/** Пігулки 56px, як на /login. */
export const primaryPillClass =
  "h-14 gap-2.5 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground hover:bg-primary/90 focus-visible:border-primary focus-visible:ring-primary/40 active:scale-[0.98] [&_svg:not([class*='size-'])]:size-5";
export const outlinePillClass =
  "h-14 gap-2 rounded-full border-foreground/25 bg-transparent px-8 text-base font-semibold text-foreground hover:bg-foreground/5 dark:border-foreground/25 dark:bg-transparent dark:hover:bg-foreground/5";

/**
 * Каркас онбордингу.
 * Мобільний: на весь екран, футер з кнопками притиснутий донизу.
 * md–lg (768–1023px): ті самі 3 кроки в картці по центру, max-w 880px.
 * lg+ (≥1024px): усе на одному екрані, картка max-w 1100px.
 *
 * `step` — поточний крок версії з кроками (<lg);
 * `completed` — кількість заповнених розділів на десктопі (lg+).
 */
export function OnboardingShell({
  step,
  completed,
  children,
}: {
  step: number;
  completed: number;
  children: React.ReactNode;
}) {
  return (
    <main className="dark flex min-h-dvh flex-1 flex-col overflow-x-clip bg-background text-foreground md:items-center md:justify-center md:px-6 md:py-10 lg:py-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:mx-0 md:min-h-[600px] md:max-w-[880px] md:flex-none md:rounded-3xl md:border md:border-white/10 md:bg-card md:px-10 md:py-9 md:shadow-2xl md:shadow-black/40 lg:min-h-0 lg:max-w-[1100px] lg:py-7">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-y-6 md:gap-x-6 md:gap-y-0">
          <Logo className="col-start-2 row-start-1 justify-self-center md:col-start-1 md:justify-self-start" />
          <form
            action={signOut}
            className="col-start-3 row-start-1 justify-self-end"
          >
            <button
              type="submit"
              className="rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              Sign out
            </button>
          </form>
          <Stepper
            current={step}
            className="col-span-3 row-start-2 justify-self-center md:col-span-1 md:col-start-2 md:row-start-1 lg:hidden"
          />
          <Stepper
            current={completed + 1}
            variant="progress"
            className="col-start-2 row-start-1 hidden justify-self-center lg:flex"
          />
        </header>
        {children}
      </div>
    </main>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Dumbbell
        className="size-7 rotate-45 text-primary md:size-8"
        strokeWidth={2.5}
        aria-hidden
      />
      <span className="font-heading text-2xl leading-none font-extrabold tracking-tight md:text-[28px]">
        <span className="text-foreground">Gain</span>
        <span className="text-primary">Step</span>
      </span>
    </div>
  );
}

const STEP_NAMES = ["Body weight", "Level", "Program"];

/**
 * Степер 1—2—3: пройдений — лайм з галочкою, майбутній — темний.
 * variant="steps": поточний крок — заповнене лаймове коло (версія з кроками).
 * variant="progress": поточний — лаймова рамка; `current - 1` = кількість
 * заповнених розділів на десктопі (порядок заповнення неважливий).
 */
export function Stepper({
  current,
  variant = "steps",
  className,
}: {
  current: number;
  variant?: "steps" | "progress";
  className?: string;
}) {
  const progress = variant === "progress";
  const completed = Math.min(current - 1, STEP_NAMES.length);

  return (
    <div className={cn("flex items-center", className)}>
      {progress && (
        <span className="sr-only" aria-live="polite">
          {`${completed} of ${STEP_NAMES.length} sections completed`}
        </span>
      )}
      <ol
        aria-label="Onboarding progress"
        aria-hidden={progress || undefined}
        className="flex items-center"
      >
        {STEP_NAMES.map((name, index) => {
          const n = index + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={name} className="flex items-center">
              {n > 1 && (
                // Трек + лаймова заливка, що плавно «наїжджає» зліва направо.
                <span
                  aria-hidden
                  className="relative h-0.5 w-9 overflow-hidden rounded-full bg-white/15 min-[380px]:w-12 md:w-20 lg:w-24"
                >
                  <span
                    className={cn(
                      "absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none",
                      n <= current ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              )}
              <span
                aria-current={active && !progress ? "step" : undefined}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[15px] font-bold transition-colors duration-300 md:size-10",
                  done && "bg-primary text-primary-foreground",
                  active &&
                    (progress
                      ? "border-2 border-primary bg-secondary text-primary"
                      : "bg-primary text-primary-foreground ring-4 ring-primary/20"),
                  !done &&
                    !active &&
                    "border border-white/10 bg-secondary text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-5" strokeWidth={3} aria-hidden />
                ) : (
                  <span aria-hidden>{n}</span>
                )}
                {!progress && (
                  <span className="sr-only">
                    {`Step ${n} of ${STEP_NAMES.length}: ${name}${done ? ", completed" : ""}`}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Заголовок кроку; фокус переводиться на нього при зміні кроку. */
export function StepHeading({
  title,
  subtitle,
  ref,
}: {
  title: string;
  subtitle?: string;
  ref?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="mb-6 md:mb-8">
      <h1
        ref={ref}
        tabIndex={-1}
        className="font-heading text-[28px] leading-tight font-extrabold tracking-tight text-foreground outline-none md:text-[34px]"
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1.5 text-[15px] text-muted-foreground md:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/**
 * Стрілки клавіатури всередині radiogroup: переводять фокус і вибір
 * (патерн WAI-ARIA для радіогруп).
 */
export function handleRadioKeys(event: React.KeyboardEvent<HTMLElement>) {
  const delta =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
  if (!delta) return;

  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)',
    ),
  );
  const index = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (index === -1) return;

  event.preventDefault();
  const next = radios[(index + delta + radios.length) % radios.length];
  next.focus();
  next.click();
}

/** Roving tabindex: у фокус потрапляє вибраний варіант, або перший, якщо нічого не вибрано. */
export function rovingTabIndex(selected: boolean, index: number, hasSelection: boolean) {
  return selected || (!hasSelection && index === 0) ? 0 : -1;
}

type Option<T extends string> = { value: T; label: string };

/** Сегментований перемикач-пігулка (kg / lb, Strength / Mass). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  ...aria
}: {
  value: T | null;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
} & ({ "aria-label": string } | { "aria-labelledby": string })) {
  return (
    <div
      role="radiogroup"
      {...aria}
      onKeyDown={handleRadioKeys}
      className={cn(
        "grid h-14 auto-cols-fr grid-flow-col gap-1 rounded-full border border-white/10 bg-secondary/60 p-1",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={rovingTabIndex(selected, index, value !== null)}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full text-[15px] font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-primary/50 focus-visible:outline-none",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const choiceBase =
  "relative rounded-3xl border-2 text-left transition-[border-color,background-color] focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none";
const choiceState = (selected: boolean) =>
  selected
    ? "border-primary bg-primary/[0.06]"
    : "border-white/10 bg-secondary/40 hover:border-white/25";

/** Велика картка вибору (рівень підготовки) з галочкою в правому верхньому куті. */
export function LevelCard({
  icon: Icon,
  title,
  description,
  selected,
  tabIndex,
  onSelect,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  tabIndex: number;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onSelect}
      className={cn(
        choiceBase,
        choiceState(selected),
        "flex min-h-44 min-w-0 flex-col items-center justify-center px-3 py-6 text-center md:min-h-52",
        className,
      )}
    >
      {selected && <CornerCheck />}
      <Icon className="size-11 text-foreground md:size-12" strokeWidth={1.75} aria-hidden />
      <span className="mt-4 text-lg font-bold text-foreground md:text-xl">{title}</span>
      <span className="mt-1 text-[13px] leading-snug text-muted-foreground md:text-sm">
        {description}
      </span>
    </button>
  );
}

/** Лаймове коло з галочкою в правому верхньому куті вибраної картки. */
function CornerCheck() {
  return (
    <span className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-200 motion-reduce:animate-none">
      <Check className="size-4" strokeWidth={3} aria-hidden />
    </span>
  );
}

/** Компактна вертикальна картка програми (десктоп): іконка зверху, галочка в куті. */
export function ProgramTile({
  icon: Icon,
  title,
  description,
  selected,
  tabIndex,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  tabIndex: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onSelect}
      className={cn(
        choiceBase,
        choiceState(selected),
        "flex h-[110px] min-w-0 flex-col items-center justify-center px-3 text-center",
      )}
    >
      {selected && <CornerCheck />}
      <Icon
        className={cn("size-7", selected ? "text-primary" : "text-foreground")}
        aria-hidden
      />
      <span className="mt-2 max-w-full truncate text-base font-bold text-foreground">
        {title}
      </span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

/** Горизонтальна картка програми з радіо-колом праворуч. */
export function ProgramCard({
  icon: Icon,
  title,
  description,
  selected,
  tabIndex,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  tabIndex: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onSelect}
      className={cn(
        choiceBase,
        choiceState(selected),
        "flex min-h-[76px] w-full items-center gap-4 px-4 py-3",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
          selected ? "bg-primary/15 text-primary" : "bg-white/5 text-foreground",
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-foreground">
          {title}
        </span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "border-2 border-white/25",
        )}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
    </button>
  );
}
