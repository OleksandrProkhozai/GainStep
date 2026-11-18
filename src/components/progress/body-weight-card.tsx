"use client";

import { useId, useState } from "react";
import { format, parseISO } from "date-fns";
import { History, Plus, Scale } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { toDayKey } from "@/lib/dates";
import {
  summarizeBodyWeight,
  toBodyUnit,
  weightDomain,
  type BodyWeightEntry,
} from "@/lib/progress/body-weight";
import type { WeightUnit } from "@/lib/units";
import { LogWeightDialog } from "./log-weight-dialog";
import { AXIS_TICK, CARD_BG, Card, CardTitle, Delta, GRID_STROKE, LIME, formatNumber, signed } from "./parts";
import { WeightHistory } from "./weight-history";

type Point = { t: number; value: number };

/**
 * Картка "Body weight": остання вага, зміна за вибраний на сторінці
 * період і графік записів періоду. Запис, редагування й видалення —
 * через діалоги "Log weight" та "History".
 */
export function BodyWeightCard({
  entries,
  unit,
  periodFrom,
}: {
  /** Усі записи, від старих до нових. */
  entries: BodyWeightEntry[];
  unit: WeightUnit;
  /** Початок вибраного періоду, мс; null — уся історія. */
  periodFrom: number | null;
}) {
  const [log, setLog] = useState<{ open: boolean; date: string | null }>({ open: false, date: null });
  const [historyOpen, setHistoryOpen] = useState(false);
  const gradientId = useId();

  const fromKey = periodFrom === null ? null : toDayKey(new Date(periodFrom));
  const { latest, inPeriod, delta, since } = summarizeBodyWeight(entries, fromKey, unit);
  const points: Point[] = inPeriod.map((e) => ({
    t: parseISO(e.date).getTime(),
    value: toBodyUnit(e.weightKg, unit),
  }));
  const domain = weightDomain(points.map((p) => p.value));

  const openLog = (date: string | null) => setLog({ open: true, date });

  return (
    <Card className="flex flex-col">
      <header className="flex items-center justify-between gap-2">
        <CardTitle>Body weight</CardTitle>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <History className="size-3.5" aria-hidden />
              History
            </button>
          )}
          <button
            type="button"
            onClick={() => openLog(null)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 px-3 text-xs font-semibold transition-colors hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden />
            Log weight
          </button>
        </div>
      </header>

      {latest && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className="font-heading text-2xl font-extrabold tracking-tight md:text-[28px]">
            {formatNumber(toBodyUnit(latest.weightKg, unit))}
            <span className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</span>
          </p>
          {delta !== null && since && (
            <span className="inline-flex items-baseline gap-1.5">
              <Delta value={delta} text={`${signed(delta)} ${unit}`} zeroText={`= 0 ${unit}`} neutralDown />
              <span className="text-xs text-muted-foreground">vs {format(parseISO(since), "MMM d")}</span>
            </span>
          )}
        </div>
      )}

      {points.length < 2 ? (
        <div className="mt-3 flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-5 py-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Scale className="size-5" aria-hidden />
          </span>
          <p className="mt-2.5 max-w-[240px] text-sm text-muted-foreground">
            Log your weight on different days to see the trend
          </p>
        </div>
      ) : (
        <div className="mt-2 min-h-[150px] flex-1">
          <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LIME} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={LIME} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => format(t, "MMM d")}
                tick={{ ...AXIS_TICK, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis
                dataKey="value"
                domain={domain}
                allowDecimals={false}
                tick={{ ...AXIS_TICK, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={30}
                tickCount={3}
              />
              <Tooltip
                cursor={{ stroke: "rgb(255 255 255 / 0.2)", strokeWidth: 1 }}
                content={(props) => <WeightTooltip {...props} unit={unit} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                name="Body weight"
                stroke={LIME}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 3, fill: LIME, stroke: CARD_BG, strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: LIME, stroke: CARD_BG, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <LogWeightDialog
        open={log.open}
        onOpenChange={(open) => setLog((s) => ({ ...s, open }))}
        entries={entries}
        unit={unit}
        initialDate={log.date}
      />
      <WeightHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entries={entries}
        unit={unit}
        onEdit={(date) => {
          setHistoryOpen(false);
          openLog(date);
        }}
      />
    </Card>
  );
}

function WeightTooltip({ active, payload, unit }: TooltipContentProps & { unit: WeightUnit }) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1c20]/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <p className="text-[11px] text-muted-foreground">{format(point.t, "EEE, MMM d")}</p>
      <p className="mt-0.5 font-heading text-base font-bold text-foreground">
        {formatNumber(point.value)} {unit}
      </p>
    </div>
  );
}
