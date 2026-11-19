"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";

/** Кнопка відправки форми старту тренування зі станом завантаження. */
export function StartWorkoutButton({
  className,
  label,
}: {
  className: string;
  label?: string;
}) {
  const t = useTranslations("dashboard");
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Play className="size-4 fill-current" aria-hidden />
      )}
      {label ?? t("startWorkout")}
    </button>
  );
}
