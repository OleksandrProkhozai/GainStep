"use client";

import { Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWeightFormat } from "@/components/i18n/use-format";
import type { HistorySet } from "@/lib/history/derive";
import { cn } from "@/lib/utils";

/**
 * Таблиця підходів: Підхід · Вага · Повт. · (1ПМ | позначка рекорду).
 * Рекордний підхід підсвічено лаймом з кубком; невиконані — приглушені.
 * variant "compact" — розгорнута картка історії (колонка 1ПМ),
 * "detail" — сторінка тренування (підпис "Новий рекорд"; 1ПМ від md).
 */
export function SetsTable({
  sets,
  variant = "compact",
  caption,
}: {
  sets: readonly HistorySet[];
  variant?: "compact" | "detail";
  caption: string;
}) {
  const t = useTranslations("history.table");
  const fmt = useWeightFormat();
  const detail = variant === "detail";
  return (
    <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <th scope="col" className="border-b border-foreground/8 px-2 py-1.5 font-semibold">{t("set")}</th>
          <th scope="col" className="border-b border-foreground/8 px-2 py-1.5 font-semibold">{t("weight")}</th>
          <th scope="col" className="border-b border-foreground/8 px-2 py-1.5 font-semibold">{t("reps")}</th>
          <th
            scope="col"
            className={cn("border-b border-foreground/8 px-2 py-1.5 font-semibold", detail && "hidden md:table-cell")}
          >
            {t("e1rm")}
          </th>
          {detail && (
            <th scope="col" className="border-b border-foreground/8 px-2 py-1.5">
              <span className="sr-only">{t("record")}</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {sets.map((s) => {
          const cell = cn(
            "px-2 py-2",
            s.isPR && "bg-primary/10 first:rounded-l-xl last:rounded-r-xl",
            !s.isCompleted && "text-muted-foreground/70",
          );
          return (
            <tr key={s.setNumber} className={cn(!s.isCompleted && "line-through decoration-foreground/25")}>
              <td className={cell}>
                <span className="inline-flex items-center gap-1.5">
                  {s.setNumber}
                  {s.isPR && !detail && (
                    <Trophy className="size-3.5 text-accent-text" aria-label={t("record")} role="img" />
                  )}
                  {!s.isCompleted && <span className="sr-only">({t("notDone")})</span>}
                </span>
              </td>
              <td className={cn(cell, "font-medium text-foreground", !s.isCompleted && "text-muted-foreground/70")}>
                {fmt.weight(s.weight)}
              </td>
              <td className={cell}>{s.reps}</td>
              <td
                className={cn(
                  cell,
                  detail && "hidden md:table-cell",
                  s.isPR && "font-semibold text-accent-text",
                )}
              >
                {s.isCompleted && s.e1rm > 0 ? fmt.value(s.e1rm) : "—"}
              </td>
              {detail && (
                <td className={cn(cell, "text-right")}>
                  {s.isPR && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-accent-text">
                      <Trophy className="size-3.5" aria-hidden />
                      {t("newRecord")}
                    </span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
