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
        className="size-7 shrink-0 rotate-45 text-primary"
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
        <span className="text-primary">Step</span>
      </span>
    </span>
  );
}

/** Ініціали для аватара: "Oleksandr Prokhozai" → "OP", "alex@x.com" → "A". */
export function getInitials(name: string) {
  const base = name.includes("@") ? name.split("@")[0] : name;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters =
    parts.length === 1 ? parts[0].slice(0, 1) : parts[0][0] + parts[1][0];
  return letters.toUpperCase();
}

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
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-heading text-sm font-extrabold text-primary ring-1 ring-primary/25",
        className,
      )}
    >
      {initials}
    </span>
  );
}
