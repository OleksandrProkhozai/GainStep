import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocale } from "next-intl";
import { dateFormat } from "@/lib/dates";
import { formatNumber as formatLocaleNumber, unitLabel, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/** "62.5" / "62,5". */
export const formatNumber = (value: number, locale = "en") => formatLocaleNumber(value, locale);

const SHORT = { month: "short", day: "numeric" } as const;
const LONG = { weekday: "short", month: "short", day: "numeric", year: "numeric" } as const;

/**
 * Числа й дати карток прогресу мовою інтерфейсу (працює і в серверних
 * компонентах, і в клієнтських): "Nov 17" / "17 лист.", "62,5".
 */
export function useProgressFormat() {
  const locale = useLocale();
  return {
    locale,
    number: (value: number) => formatNumber(value, locale),
    signed: (value: number) => signed(value, locale),
    unit: (unit: WeightUnit) => unitLabel(unit, locale),
    /** Момент часу в поясі користувача. */
    shortDate: (t: number | Date) => dateFormat(locale, SHORT).format(t),
    longDate: (t: number | Date) => dateFormat(locale, LONG).format(t),
    /** Календарна дата "YYYY-MM-DD" (без зсуву поясу). */
    dayKey: (key: string) =>
      dateFormat(locale, { ...SHORT, timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`)),
  };
}

export function Card({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-foreground/10 bg-card p-4 md:p-5", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("font-heading text-base font-bold md:text-lg", className)}>{children}</h2>;
}

/**
 * Зміна показника зі стрілкою: зростання — лаймове, падіння — помаранчеве
 * (або сіре, якщо падіння не погане — як для ваги тіла).
 */
export function Delta({
  value,
  text,
  neutralDown = false,
  zeroText = "±0",
  className,
}: {
  value: number;
  /** Готовий підпис: "+5 kg", "−12%". */
  text: string;
  neutralDown?: boolean;
  /** Підпис для нульової зміни. */
  zeroText?: string;
  className?: string;
}) {
  if (value === 0) {
    return (
      <span className={cn("text-xs font-semibold whitespace-nowrap text-muted-foreground md:text-sm", className)}>
        {zeroText}
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap md:text-sm",
        up ? "text-accent-text" : neutralDown ? "text-muted-foreground" : "text-orange-400",
        className,
      )}
    >
      <Icon className="size-3.5 md:size-4" strokeWidth={2.5} aria-hidden />
      {text}
    </span>
  );
}

/** "+5", "−2.5" (справжній мінус; uk — "−2,5"). */
export function signed(value: number, locale = "en") {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value), locale)}`;
}
