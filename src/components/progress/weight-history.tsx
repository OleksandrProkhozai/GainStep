"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteBodyWeight } from "@/lib/progress/actions";
import { historyRows, toBodyUnit, type BodyWeightEntry } from "@/lib/progress/body-weight";
import type { WeightUnit } from "@/lib/units";
import { Delta, formatNumber, signed } from "./parts";

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

const TITLE = "Weight history";
const DESCRIPTION = "One entry per day, newest first.";

/** Історія записів ваги: діалог на md+, шторка знизу на телефоні. */
export function WeightHistory({
  open,
  onOpenChange,
  entries,
  unit,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: BodyWeightEntry[];
  unit: WeightUnit;
  /** Відкрити "Log weight" на цю дату. */
  onEdit: (date: string) => void;
}) {
  const wide = useIsWide();
  const list = <HistoryList entries={entries} unit={unit} onEdit={onEdit} />;

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="dark flex max-h-[min(640px,85dvh)] flex-col border-white/10 bg-card text-foreground sm:max-w-md">
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
        className="dark max-h-[85dvh] gap-0 rounded-t-3xl border-white/10 bg-card pb-[env(safe-area-inset-bottom)] text-foreground"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
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
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rows = historyRows(entries, unit);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No entries yet</p>;
  }

  const remove = (date: string) => {
    startTransition(async () => {
      const result = await deleteBodyWeight(date);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirming(null);
      toast.success("Entry deleted");
    });
  };

  return (
    <ul className="-mx-1 min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto px-1">
      {rows.map((row) => {
        const weight = `${formatNumber(toBodyUnit(row.weightKg, unit))} ${unit}`;
        const day = format(parseISO(row.date), "EEE, MMM d, yyyy");
        if (confirming === row.date) {
          return (
            <li key={row.date} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <p className="text-sm">
                Delete <span className="font-semibold">{weight}</span> on {format(parseISO(row.date), "MMM d")}?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setConfirming(null)}
                  disabled={pending}
                >
                  Cancel
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
                  Delete
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
              <Delta value={row.diff} text={`${signed(row.diff)} ${unit}`} zeroText="= 0" neutralDown className="md:text-xs" />
            )}
            <div className="flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-xs"
                aria-label={`Edit ${weight} on ${day}`}
                onClick={() => onEdit(row.date)}
                disabled={pending}
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${weight} on ${day}`}
                onClick={() => setConfirming(row.date)}
                disabled={pending}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
