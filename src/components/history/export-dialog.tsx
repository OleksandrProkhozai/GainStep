"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { monthBounds } from "@/lib/history/month";
import { cn } from "@/lib/utils";
import { monthTitle } from "./format";

type Scope = "month" | "all";

/** Ім'я файлу з Content-Disposition (запасне — передане). */
function fileNameFrom(res: Response, fallback: string) {
  const header = res.headers.get("Content-Disposition") ?? "";
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback;
}

/** Діалог експорту: поточний місяць або всі тренування → .xlsx. */
function ExportDialog({ open, onOpenChange, month }: { open: boolean; onOpenChange: (o: boolean) => void; month: string }) {
  const t = useTranslations("history.export");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const locale = useLocale();
  const [scope, setScope] = useState<Scope>("month");
  const [pending, setPending] = useState(false);

  const download = async () => {
    setPending(true);
    try {
      const { first, last } = monthBounds(month);
      const url = scope === "month" ? `/api/export/workouts?from=${first}&to=${last}` : "/api/export/workouts";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`export ${res.status}`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileNameFrom(res, `gainstep-workouts-${scope === "month" ? month : "all"}.xlsx`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      onOpenChange(false);
    } catch (error) {
      console.error("export", error);
      toast.error(errorText("exportFailed"));
    } finally {
      setPending(false);
    }
  };

  const options: { id: Scope; label: string; hint?: string }[] = [
    { id: "month", label: t("month"), hint: monthTitle(month, locale) },
    { id: "all", label: t("all") },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="border-foreground/10 bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="sr-only">{t("title")}</legend>
          {options.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition has-focus-visible:ring-3 has-focus-visible:ring-primary/40",
                scope === o.id ? "border-primary/50 bg-primary/8" : "border-foreground/10 hover:bg-foreground/3",
              )}
            >
              <input
                type="radio"
                name="export-scope"
                value={o.id}
                checked={scope === o.id}
                onChange={() => setScope(o.id)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="flex-1 text-sm font-semibold">{o.label}</span>
              {o.hint && <span className="text-sm text-muted-foreground">{o.hint}</span>}
            </label>
          ))}
        </fieldset>
        <DialogFooter className="border-foreground/10 bg-foreground/2">
          <Button variant="outline" className="h-10 rounded-full px-5" onClick={() => onOpenChange(false)} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button
            className="h-10 rounded-full bg-primary px-5 font-bold text-primary-foreground hover:bg-primary/90"
            onClick={download}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Кнопка "Експорт у Excel" (desktop, угорі сторінки). */
export function ExportButton({ month, className }: { month: string; className?: string }) {
  const t = useTranslations("history.export");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border border-foreground/25 px-5 text-sm font-bold transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
          className,
        )}
      >
        <Download className="size-4" aria-hidden />
        {t("button")}
      </button>
      <ExportDialog open={open} onOpenChange={setOpen} month={month} />
    </>
  );
}

/** Меню "…" сторінки історії на телефоні (експорт). */
export function HistoryMenu({ month, className }: { month: string; className?: string }) {
  const t = useTranslations("history");
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("moreActions")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full border border-foreground/12 bg-card transition hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
            className,
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <FileSpreadsheet aria-hidden />
            {t("export.button")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ExportDialog open={open} onOpenChange={setOpen} month={month} />
    </>
  );
}
