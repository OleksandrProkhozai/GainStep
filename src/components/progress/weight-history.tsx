"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/components/i18n/use-error-text";
import { useDateFns } from "@/components/i18n/use-format";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteBodyWeight } from "@/lib/progress/actions";
import { historyRows, toBodyUnit, type BodyWeightEntry } from "@/lib/progress/body-weight";
import { useUnit } from "@/components/preferences/preferences-provider";
import type { WeightUnit } from "@/lib/units";
import { Delta, useProgressFormat } from "./parts";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** true від md (768px). На сервері — false (історія відкривається лише на клієнті). */
function useIsWide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}


/** Історія записів ваги: діалог на md+, шторка знизу на телефоні. */
export function WeightHistory({
  open,
  onOpenChange,
  entries,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: BodyWeightEntry[];
  /** Відкрити "Log weight" на цю дату. */
  onEdit: (date: string) => void;
}) {
  const unit = useUnit();
  const t = useTranslations("progress.history");
  const TITLE = t("title");
  const DESCRIPTION = t("description");
  const wide = useIsWide();
  const list = <HistoryList entries={entries} unit={unit} onEdit={onEdit} />;

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(640px,85dvh)] flex-col border-foreground/10 bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{TITLE}</DialogTitle>
            <DialogDescription>{DESCRIPTION}</DialogDescription>
          </DialogHeader>
          {list}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 rounded-t-3xl border-foreground/10 bg-card pb-[env(safe-area-inset-bottom)] text-foreground"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-foreground/15" />
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-lg font-bold">{TITLE}</SheetTitle>
          <SheetDescription>{DESCRIPTION}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{list}</div>
      </SheetContent>
    </Sheet>
  );
}

function HistoryList({
  entries,
  unit,
  onEdit,
}: {
  entries: BodyWeightEntry[];
  unit: WeightUnit;
  onEdit: (date: string) => void;
}) {
  const t = useTranslations("progress.history");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const pf = useProgressFormat();
  const fmtDate = useDateFns();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rows = historyRows(entries, unit);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  const remove = (date: string) => {
    startTransition(async () => {
      const result = await deleteBodyWeight(date);
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      setConfirming(null);
      toast.success(t("deleted"));
    });
  };

  return (
    <ul className="-mx-1 min-h-0 flex-1 divide-y divide-foreground/5 overflow-y-auto px-1">
      {rows.map((row) => {
        const weight = `${pf.number(toBodyUnit(row.weightKg, unit))} ${pf.unit(unit)}`;
        const day = fmtDate(parseISO(row.date), "full");
        if (confirming === row.date) {
          return (
            <li key={row.date} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <p className="text-sm">
                {t.rich("confirm", {
                  weight,
                  date: fmtDate(parseISO(row.date), "short"),
                  b: (chunks) => <span className="font-semibold">{chunks}</span>,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setConfirming(null)}
                  disabled={pending}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full font-bold"
                  onClick={() => remove(row.date)}
                  disabled={pending}
                  aria-busy={pending}
                  autoFocus
                >
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  {t("delete")}
                </Button>
              </div>
            </li>
          );
        }
        return (
          <li key={row.date} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{weight}</p>
              <p className="text-xs text-muted-foreground">{day}</p>
            </div>
            {row.diff !== null && (
              <Delta value={row.diff} text={`${pf.signed(row.diff)} ${pf.unit(unit)}`} zeroText="= 0" neutralDown className="md:text-xs" />
            )}
            <div className="flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-xs"
                aria-label={t("editLabel", { weight, date: day })}
                onClick={() => onEdit(row.date)}
                disabled={pending}
              >
                <Pencil className="size-3.5" aria-hidden />
                {t("edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive"
                aria-label={t("deleteLabel", { weight, date: day })}
                onClick={() => setConfirming(row.date)}
                disabled={pending}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("delete")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
