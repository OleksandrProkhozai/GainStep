import { useTranslations } from "next-intl";
import { templateSchedule } from "@/lib/programs/templates";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database.types";

/** "3× на тиждень · 2 дні по черзі" з days_per_week і кількості днів. */
export function useScheduleText() {
  const t = useTranslations("programs.template");
  return (daysPerWeek: number, dayCount: number) => {
    const s = templateSchedule(daysPerWeek, dayCount);
    // ICU select — за рядком "true" / "false".
    return t("schedule", { perWeek: s.perWeek, days: s.days, alternating: String(s.alternating) });
  };
}

/** Бейдж рівня шаблону: "Початківець" / "Середній". */
export function LevelBadge({ level, className }: { level: Enums<"experience_level">; className?: string }) {
  const t = useTranslations("common.enums.experience");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-bold text-foreground/85",
        className,
      )}
    >
      {t(level)}
    </span>
  );
}
