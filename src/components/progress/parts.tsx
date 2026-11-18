import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { USER_TIME_ZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const LIME = "#c6f432";
export const ORANGE = "#fb923c";
export const CARD_BG = "#16171a";
export const AXIS_TICK = { fill: "#8b8f98", fontSize: 11 };
export const GRID_STROKE = "rgb(255 255 255 / 0.06)";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
export const formatNumber = (value: number) => number.format(value);

/** "Nov 17" — момент часу в поясі користувача. */
export const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: USER_TIME_ZONE,
});
export const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: USER_TIME_ZONE,
});

/** Календарна дата "YYYY-MM-DD" → "Nov 17" (без зсуву поясу). */
const dayKeyFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
export const formatDayKey = (key: string) => dayKeyFormat.format(new Date(`${key}T00:00:00Z`));

export function Card({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-white/10 bg-card p-4 md:p-5", className)}
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
        up ? "text-primary" : neutralDown ? "text-muted-foreground" : "text-orange-400",
        className,
      )}
    >
      <Icon className="size-3.5 md:size-4" strokeWidth={2.5} aria-hidden />
      {text}
    </span>
  );
}

/** "+5", "−2.5" (справжній мінус). */
export function signed(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value))}`;
}
