import { muscleStyle } from "@/lib/exercises/muscles";
import { cn } from "@/lib/utils";

/**
 * Плитка групи м'язів: фон — колір родини з прозорістю ~14%,
 * всередині двобуквений код (Manrope 700) кольором родини.
 */
export function MuscleTile({
  group,
  size = "md",
  className,
}: {
  group: string;
  /** md — 44×44, sm — 36×36. */
  size?: "md" | "sm";
  className?: string;
}) {
  const { code, color } = muscleStyle(group);
  return (
    <span
      aria-hidden
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl font-heading font-bold tracking-wide select-none",
        size === "sm" ? "size-9 text-xs" : "size-11 text-sm",
        className,
      )}
    >
      {code}
    </span>
  );
}
