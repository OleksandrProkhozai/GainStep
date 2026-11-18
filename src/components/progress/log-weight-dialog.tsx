"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronDown, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, toDayKey } from "@/lib/dates";
import {
  BODY_WEIGHT_LIMITS,
  parseBodyWeightInput,
  toBodyUnit,
  type BodyWeightEntry,
} from "@/lib/progress/body-weight";
import { logBodyWeight } from "@/lib/progress/actions";
import type { WeightUnit } from "@/lib/units";
import { formatNumber } from "./parts";

/**
 * Діалог "Log weight": вага + дата (за замовчуванням сьогодні, майбутні
 * дати заборонені). Один запис на день — якщо на дату вже є запис,
 * показуємо це й підставляємо його значення: збереження його оновить.
 */
export function LogWeightDialog({
  open,
  onOpenChange,
  entries,
  unit,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: BodyWeightEntry[];
  unit: WeightUnit;
  /** Дата для редагування з історії; null — сьогодні. */
  initialDate: string | null;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="dark border-white/10 bg-card text-foreground">
        {/* Форма монтується при кожному відкритті — стан щоразу свіжий. */}
        <LogWeightForm
          entries={entries}
          unit={unit}
          initialDate={initialDate}
          onPendingChange={setPending}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LogWeightForm({
  entries,
  unit,
  initialDate,
  onPendingChange,
  onDone,
}: {
  entries: BodyWeightEntry[];
  unit: WeightUnit;
  initialDate: string | null;
  onPendingChange: (pending: boolean) => void;
  onDone: () => void;
}) {
  const [today] = useState(() => toDayKey(new Date()));
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const valueFor = (date: string) => {
    const entry = byDate.get(date);
    return entry ? String(toBodyUnit(entry.weightKg, unit)) : "";
  };

  const [date, setDate] = useState(initialDate ?? today);
  const [value, setValue] = useState(() => valueFor(initialDate ?? today));
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const existing = byDate.get(date);
  const latest = entries.at(-1);
  const { min, max } = BODY_WEIGHT_LIMITS[unit];

  const pickDate = (next: Date | undefined) => {
    if (!next) return;
    const key = format(next, "yyyy-MM-dd");
    if (key > today) return;
    setDate(key);
    setCalendarOpen(false);
    setError(null);
    // На дату вже є запис — підставляємо його значення.
    if (byDate.has(key)) setValue(valueFor(key));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseBodyWeightInput(value, unit);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onPendingChange(true);
    startTransition(async () => {
      const result = await logBodyWeight({ value: parsed.value, unit, date });
      onPendingChange(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const next = formatNumber(toBodyUnit(result.weightKg, unit));
      toast.success(
        result.previousKg === null
          ? "Weight logged"
          : `Weight updated: ${formatNumber(toBodyUnit(result.previousKg, unit))} → ${next} ${unit}`,
      );
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">Log body weight</DialogTitle>
        <DialogDescription>One entry per day. Weigh yourself at the same time of day for a cleaner trend.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <span id="log-date-label" className="text-xs font-semibold text-muted-foreground">
          Date
        </span>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-labelledby="log-date-label log-date-value"
              disabled={pending}
              className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 px-3.5 text-left text-sm font-semibold outline-none focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20"
            >
              <CalendarDays className="size-4 text-primary" aria-hidden />
              <span id="log-date-value">{dateLabel(date, today)}</span>
              <ChevronDown className="ml-auto size-4 text-muted-foreground" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="dark w-auto border-white/10 bg-card p-1 text-foreground">
            <Calendar
              mode="single"
              selected={parseISO(date)}
              onSelect={pickDate}
              defaultMonth={parseISO(date)}
              endMonth={parseISO(today)}
              disabled={{ after: parseISO(today) }}
              weekStartsOn={1}
              className="bg-transparent [--cell-size:--spacing(9)]"
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="log-weight-value" className="text-xs font-semibold text-muted-foreground">
          Weight
        </label>
        <div className="relative">
          <input
            id="log-weight-value"
            autoFocus
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            placeholder={latest ? String(toBodyUnit(latest.weightKg, unit)) : unit === "kg" ? "73.4" : "162"}
            aria-invalid={error !== null}
            aria-describedby={[existing ? "log-weight-hint" : "", error ? "log-weight-error" : ""].join(" ").trim() || undefined}
            className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pr-12 pl-4 font-heading text-xl font-bold outline-none placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20 aria-invalid:border-destructive/60"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
            {unit}
          </span>
        </div>
        {existing && (
          <p id="log-weight-hint" className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
            You already logged {formatNumber(toBodyUnit(existing.weightKg, unit))} {unit} on{" "}
            {format(parseISO(date), "MMM d")} — it will be updated
          </p>
        )}
        {error ? (
          <p id="log-weight-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          !existing && (
            <p className="text-xs text-muted-foreground">
              {min}–{max} {unit}, one decimal place
            </p>
          )
        )}
      </div>

      <DialogFooter className="border-white/10 bg-white/2">
        <Button type="button" variant="outline" className="h-10 rounded-full px-5" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-10 rounded-full bg-primary px-5 font-bold text-primary-foreground hover:bg-primary/90"
          disabled={pending}
          aria-busy={pending}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {existing ? "Update" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function dateLabel(date: string, today: string) {
  const formatted = format(parseISO(date), "EEE, MMM d, yyyy");
  if (date === today) return `Today · ${formatted}`;
  if (date === addDays(today, -1)) return `Yesterday · ${formatted}`;
  return formatted;
}
