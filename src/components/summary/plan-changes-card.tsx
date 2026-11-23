"use client";

import { useState, useTransition } from "react";
import { Check, ListPlus, Loader2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { cn } from "@/lib/utils";
import { applyWorkoutChangesToProgram } from "@/lib/workout/actions";
import type { PlanChangesCard as PlanChangesData } from "@/lib/workout/summary-queries";
import { Card, CardTitle, pill } from "./parts";

/**
 * "Ви змінили склад тренування": тренування — разова зміна, програма сама
 * не змінюється. Кнопка переносить зміни в день програми (додані — у кінець
 * дня, прибрані — з дня) через save_program.
 */
export function PlanChangesCard({
  workoutId,
  changes,
  className,
}: {
  workoutId: string;
  changes: PlanChangesData;
  className?: string;
}) {
  const t = useTranslations("summary.planChanges");
  const errorText = useErrorText();
  const [applied, setApplied] = useState(false);
  const [pending, startTransition] = useTransition();

  const apply = () =>
    startTransition(async () => {
      const result = await applyWorkoutChangesToProgram(workoutId);
      if (result.ok) {
        setApplied(true);
        toast.success(t("updated", { day: changes.dayName }));
      } else {
        toast.error(errorText(result.error));
      }
    });

  return (
    <Card className={className} aria-labelledby="plan-changes-heading">
      <CardTitle id="plan-changes-heading" icon={<ListPlus className="size-5 text-foreground/85" aria-hidden />}>
        {t("title")}
      </CardTitle>
      <p className="mt-1 text-sm text-muted-foreground">{t("text")}</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {changes.added.map((name, i) => (
          <li key={`a${i}`} className="flex items-center gap-2.5 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-accent-text">
              <Plus className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <span className="sr-only">{t("addedSr")}</span>
            <span className="min-w-0 truncate font-medium">{name}</span>
          </li>
        ))}
        {changes.removed.map((name, i) => (
          <li key={`r${i}`} className="flex items-center gap-2.5 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Minus className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <span className="sr-only">{t("removedSr")}</span>
            <span className="min-w-0 truncate text-muted-foreground line-through">{name}</span>
          </li>
        ))}
      </ul>
      {applied ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent-text" role="status">
          <Check className="size-4" strokeWidth={3} aria-hidden />
          {t("updated", { day: changes.dayName })}
        </p>
      ) : (
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          aria-busy={pending}
          className={cn(
            pill,
            "mt-4 h-11 w-full border border-foreground/25 px-4 text-sm hover:bg-foreground/5 disabled:opacity-60",
          )}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          <span className="truncate">{t("apply", { day: changes.dayName })}</span>
        </button>
      )}
    </Card>
  );
}
