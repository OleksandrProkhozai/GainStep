"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ChartLine } from "lucide-react";
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
import type { ExerciseSession, WeightChange } from "@/lib/progress/derive";
import { toDisplayWeight, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import {
  AXIS_TICK,
  CARD_BG,
  Card,
  CardTitle,
  GRID_STROKE,
  LIME,
  ORANGE,
  formatNumber,
  longDate,
  shortDate,
} from "./parts";

type Metric = "weight" | "e1rm";

type ChartPoint = {
  t: number;
  value: number;
  change: WeightChange | null;
  bestWeight: number;
  bestReps: number;
};

const METRICS: { key: Metric; label: string }[] = [
  { key: "weight", label: "Weight" },
  { key: "e1rm", label: "Est. 1RM" },
];

/**
 * Графік вправи: робоча вага або оцінка 1ПМ по тренуваннях.
 * Стрілки над точками — зміна робочої ваги (збільшення / deload).
 */
export function ExerciseChart({
  title,
  sessions,
  unit,
}: {
  title: string;
  /** Тренування вибраного періоду, від старих до нових. */
  sessions: ExerciseSession[];
  unit: WeightUnit;
}) {
  const [metric, setMetric] = useState<Metric>("weight");
  const gradientId = useId();

  const points: ChartPoint[] = sessions.map((s) => ({
    t: s.t,
    value: toDisplayWeight(metric === "weight" ? s.workingWeight : s.e1rm, unit),
    change: s.change,
    bestWeight: toDisplayWeight(s.bestSet.weight, unit),
    bestReps: s.bestSet.reps,
  }));
  const step = unit === "kg" ? 5 : 10;

  return (
    <Card className="flex flex-col md:p-6">
      <header className="flex items-center justify-between gap-3">
        <CardTitle className="truncate">{title}</CardTitle>
        <div
          role="radiogroup"
          aria-label="Chart metric"
          className="flex shrink-0 rounded-full border border-white/10 bg-white/[0.03] p-0.5"
        >
          {METRICS.map((m) => {
            const active = m.key === metric;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMetric(m.key)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs font-bold transition-colors focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mt-3 h-[210px] md:h-[260px]">
        {points.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <ChartLine className="size-5" aria-hidden />
            </span>
            <p className="mt-3 max-w-[260px] text-sm text-muted-foreground">
              No sessions with this exercise in this period
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 26, right: 10, bottom: 0, left: 0 }} accessibilityLayer>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LIME} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={LIME} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} vertical />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => shortDate.format(t)}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={28}
                padding={{ left: 14, right: 14 }}
              />
              <YAxis
                dataKey="value"
                domain={[
                  (min: number) => Math.max(0, Math.floor((min - step / 2) / step) * step),
                  (max: number) => Math.ceil((max + step / 2) / step) * step,
                ]}
                allowDecimals={false}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={36}
                tickCount={4}
              />
              <Tooltip
                cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeWidth: 1 }}
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    unit={unit}
                    label={metric === "weight" ? "Working weight" : "Estimated 1RM"}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={metric === "weight" ? "Working weight" : "Estimated 1RM"}
                stroke={LIME}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={(props: DotProps) => <SessionDot key={props.index} {...props} />}
                activeDot={{ r: 6, fill: LIME, stroke: CARD_BG, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {points.length > 0 && (
        <p className="mt-3 flex items-center justify-center gap-5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="size-3.5 text-primary" strokeWidth={2.5} aria-hidden />
            Weight increased
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowDown className="size-3.5 text-orange-400" strokeWidth={2.5} aria-hidden />
            Deload
          </span>
        </p>
      )}
    </Card>
  );
}

type DotProps = { cx?: number; cy?: number; index?: number; payload?: ChartPoint };

/** Точка тренування; над нею — стрілка, якщо робоча вага змінилась. */
function SessionDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return <g />;
  const color = payload.change === "deload" ? ORANGE : LIME;
  const top = cy - 22;
  const bottom = cy - 11;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={payload.change === "deload" ? ORANGE : CARD_BG} stroke={color} strokeWidth={2} />
      {payload.change && (
        <path
          d={
            payload.change === "increase"
              ? `M${cx} ${bottom}V${top}M${cx - 3.5} ${top + 3.5}L${cx} ${top}L${cx + 3.5} ${top + 3.5}`
              : `M${cx} ${top}V${bottom}M${cx - 3.5} ${bottom - 3.5}L${cx} ${bottom}L${cx + 3.5} ${bottom - 3.5}`
          }
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

function ChartTooltip({
  active,
  payload,
  unit,
  label,
}: TooltipContentProps & { unit: WeightUnit; label: string }) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1c20]/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <p className="text-[11px] text-muted-foreground">{longDate.format(point.t)}</p>
      <p className="mt-0.5 font-heading text-base font-bold text-foreground">
        {formatNumber(point.value)} {unit}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-foreground/80">
        Best set {formatNumber(point.bestWeight)} {unit} × {point.bestReps}
      </p>
      {point.change && (
        <p className={cn("text-[11px] font-semibold", point.change === "increase" ? "text-primary" : "text-orange-400")}>
          {point.change === "increase" ? "Weight increased" : "Deload"}
        </p>
      )}
    </div>
  );
}
