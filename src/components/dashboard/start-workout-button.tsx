"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Play } from "lucide-react";

/** Кнопка відправки форми старту тренування зі станом завантаження. */
export function StartWorkoutButton({
  className,
  label = "Start workout",
}: {
  className: string;
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Play className="size-4 fill-current" aria-hidden />
      )}
      {label}
    </button>
  );
}
