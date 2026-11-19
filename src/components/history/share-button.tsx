"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useWeightFormat } from "@/components/i18n/use-format";
import type { HistoryWorkout } from "@/lib/history/derive";
import { cn } from "@/lib/utils";
import { durationText, shortDate, volumeText } from "./format";

export type ShareableWorkout = Pick<HistoryWorkout, "id" | "name" | "dayKey" | "stats" | "prCount">;

/**
 * Поділитися тренуванням: PNG з /api/workouts/[id]/share-image.
 * Якщо браузер вміє ділитися файлами (navigator.canShare({ files })) —
 * Web Share API з картинкою і текстом; інакше картинка завантажується,
 * а короткий текстовий підсумок копіюється в буфер обміну.
 * Картинку можна підвантажити заздалегідь (prefetch на наведення/фокус),
 * щоб на телефоні share() викликався ще в межах жесту користувача.
 */
export function useShareWorkout(workout: ShareableWorkout) {
  const t = useTranslations("history.share");
  const ts = useTranslations("history.card");
  const locale = useLocale();
  const fmt = useWeightFormat();
  const [pending, setPending] = useState(false);
  const fileRef = useRef<Promise<File> | null>(null);

  const loadFile = useCallback(() => {
    if (!fileRef.current) {
      fileRef.current = fetch(`/api/workouts/${workout.id}/share-image`)
        .then((res) => {
          if (!res.ok) throw new Error(`share-image ${res.status}`);
          return res.blob();
        })
        .then((blob) => new File([blob], `gainstep-workout-${workout.dayKey}.png`, { type: "image/png" }));
      fileRef.current.catch(() => {
        fileRef.current = null;
      });
    }
    return fileRef.current;
  }, [workout.id, workout.dayKey]);

  const summaryText = useCallback(() => {
    const parts = [
      workout.name,
      shortDate(workout.dayKey, locale),
      durationText(workout.stats.durationMinutes, locale),
      volumeText(workout.stats.volumeKg, fmt.unit, locale),
      ts("sets", { count: workout.stats.setsDone }),
    ];
    if (workout.prCount > 0) parts.push(`🏆 ${ts("prs", { count: workout.prCount })}`);
    return `${t("text")}: ${parts.join(" · ")}`;
  }, [workout, locale, fmt.unit, t, ts]);

  const share = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const file = await loadFile();
      const text = summaryText();
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: t("text"), text });
          return;
        } catch (error) {
          // Користувач закрив меню — це не помилка.
          if (error instanceof DOMException && error.name === "AbortError") return;
          // NotAllowedError (втрачено жест) тощо — запасний варіант нижче.
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t("downloaded"));
      } catch {
        toast.success(t("downloadedNoCopy"));
      }
    } catch (error) {
      console.error("share workout", error);
      toast.error(t("failed"));
    } finally {
      setPending(false);
    }
  }, [pending, loadFile, summaryText, t]);

  /** Підвантаження картинки заздалегідь (помилки ігноруються — повторимо при кліку). */
  const prefetch = useCallback(() => {
    loadFile().catch(() => {});
  }, [loadFile]);

  return { share, prefetch, pending };
}

/** Кнопка "Поділитися" (вигляд — outline або лайм). */
export function ShareButton({
  workout,
  variant = "outline",
  className,
}: {
  workout: ShareableWorkout;
  variant?: "outline" | "lime";
  className?: string;
}) {
  const t = useTranslations("history.card");
  const { share, prefetch, pending } = useShareWorkout(workout);
  return (
    <button
      type="button"
      onClick={share}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      aria-busy={pending}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:opacity-60",
        variant === "lime"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-foreground/25 hover:bg-foreground/5",
        className,
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {t("share")}
    </button>
  );
}
