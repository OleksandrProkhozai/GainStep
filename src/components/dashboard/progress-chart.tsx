"use client";

import { useId, useMemo, useState } from "react";
import { ChartLine } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { WeightUnit } from "@/lib/units";

export type ChartPoint = {
  /** Час тренування, мс від епохи. */
  t: number;
  /** Оцінка 1ПМ в одиницях користувача (округлена до 0.5). */
  value: number;
};

const RANGES = [
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 91 },
  { key: "1Y", label: "1Y", days: 366 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const DAY_MS = 24 * 60 * 60 * 1000;
const LIME = "#c6f432";
const TIME_ZONE = "Europe/Kiev";

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});
const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * Картка "Your progress": оцінка 1ПМ вправи за тренуваннями.
 * `now` приходить із сервера, щоб фільтр діапазону був детермінованим.
 */
export function ProgressChart({
  exerciseName,
  unit,
  points,
  now,
}: {
  exerciseName: string | null;
  unit: WeightUnit;
  points: ChartPoint[];
  now: number;
}) {
  const [range, setRange] = useState<RangeKey>("1M");
  const gradientId = useId();

  const visible = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const from = now - days * DAY_MS;
    return points.filter((p) => p.t >= from);
  }, [points, range, now]);

  const hasAnyData = points.length > 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold">Your progress</h2>
          {hasAnyData && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground/90">{exerciseName}</span>
              {" · "}Estimated 1RM, {unit}
            </p>
          )}
        </div>
        {hasAnyData && (
          <div
            role="radiogroup"
            aria-label="Time range"
            className="flex gap-1.5"
          >
            {RANGES.map((r) => {
              const active = r.key === range;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "h-8 min-w-11 rounded-full px-3 text-xs font-bold transition-colors focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="mt-4 h-[220px] md:h-[260px]">
        {!hasAnyData ? (
          <ChartEmpty text="Your progress will appear after the first workout" />
        ) : visible.length === 0 ? (
          <ChartEmpty text="No workouts with this exercise in this period" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={visible}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LIME} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={LIME} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgb(255 255 255 / 0.06)"
                strokeDasharray="0"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => shortDate.format(t)}
                tick={{ fill: "#8b8f98", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={24}
                padding={{ left: 12, right: 12 }}
              />
              <YAxis
                dataKey="value"
                domain={[
                  (min: number) => Math.max(0, Math.floor((min - 5) / 5) * 5),
                  (max: number) => Math.ceil((max + 5) / 5) * 5,
                ]}
                allowDecimals={false}
                tick={{ fill: "#8b8f98", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickCount={4}
              />
              <Tooltip
                cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeWidth: 1 }}
                content={(props) => <ChartTooltip {...props} unit={unit} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                name="Estimated 1RM"
                stroke={LIME}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 4, fill: "#16171a", stroke: LIME, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: LIME, stroke: "#16171a", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  unit,
}: TooltipContentProps & { unit: WeightUnit }) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1c20]/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <p className="text-[11px] text-muted-foreground">
        {longDate.format(point.t)}
      </p>
      <p className="mt-0.5 font-heading text-base font-bold text-foreground">
        {number.format(point.value)} {unit}
      </p>
      <p className="text-[11px] text-muted-foreground">Estimated 1RM</p>
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <ChartLine className="size-5" aria-hidden />
      </span>
      <p className="mt-3 max-w-[260px] text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
