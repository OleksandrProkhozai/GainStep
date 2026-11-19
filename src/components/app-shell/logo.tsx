import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

/** Лаймова гантеля + "GainStep". `compact` — лише іконка. */
export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Dumbbell
        className="size-7 shrink-0 rotate-45 text-accent-text"
        strokeWidth={2.5}
        aria-hidden
      />
      <span
        className={cn(
          "font-heading text-[22px] leading-none font-extrabold tracking-tight",
          compact && "sr-only",
        )}
      >
        <span className="text-foreground">Gain</span>
        <span className="text-accent-text">Step</span>
      </span>
    </span>
  );
}

export { getInitials } from "@/lib/profile/initials";

export function Avatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-heading text-sm font-extrabold text-accent-text ring-1 ring-primary/25",
        className,
      )}
    >
      {initials}
    </span>
  );
}
