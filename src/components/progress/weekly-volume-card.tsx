"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, type TooltipContentProps } from "recharts";
import { percentChange, type WeekVolume } from "@/lib/progress/derive";
import { formatVolume, kgToUnit, type WeightUnit } from "@/lib/units";
import { AXIS_TICK, Card, CardTitle, Delta, LIME, formatDayKey, formatNumber, signed } from "./parts";

type BarPoint = { label: string; value: number; volumeKg: number };

/** Тоннаж за останні тижні; поточний тиждень — яскравим стовпчиком. */
export function WeeklyVolumeCard({ weeks, unit }: { weeks: WeekVolume[]; unit: WeightUnit }) {
  const current = weeks.at(-1)?.volumeKg ?? 0;
  const previous = weeks.at(-2)?.volumeKg ?? 0;
  const change = percentChange(current, previous);
  const total = formatVolume(current, unit);
  const data: BarPoint[] = weeks.map((w) => ({
    label: formatDayKey(w.week),
    value: Math.round(kgToUnit(w.volumeKg, unit)),
    volumeKg: w.volumeKg,
  }));
  const empty = weeks.every((w) => w.volumeKg === 0);

  return (
    <Card className="flex flex-col">
      <CardTitle>Weekly volume</CardTitle>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p className="font-heading text-2xl font-extrabold tracking-tight md:text-[28px]">
          {total.value}
          <span className="ml-1 text-sm font-semibold text-muted-foreground">{total.unit}</span>
        </p>
        {change !== null && (
          <span className="inline-flex items-baseline gap-1.5">
            <Delta value={change} text={`${signed(change)}%`} />
            <span className="hidden text-xs text-muted-foreground sm:inline">vs last week</span>
          </span>
        )}
      </div>

      <div className="mt-3 min-h-[130px] flex-1">
        {empty ? (
          <p className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-muted-foreground">
            No training volume in the last {weeks.length} weeks
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={130}>
            <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} accessibilityLayer>
              <XAxis
                dataKey="label"
                tick={{ ...AXIS_TICK, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                content={(props) => <VolumeTooltip {...props} unit={unit} />}
              />
              <Bar dataKey="value" name="Volume" radius={[5, 5, 2, 2]} maxBarSize={36} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={d.label} fill={LIME} fillOpacity={i === data.length - 1 ? 1 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function VolumeTooltip({ active, payload, unit }: TooltipContentProps & { unit: WeightUnit }) {
  const point = payload?.[0]?.payload as BarPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1c20]/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <p className="text-[11px] text-muted-foreground">Week of {point.label}</p>
      <p className="mt-0.5 font-heading text-base font-bold text-foreground">
        {formatNumber(point.value)} {unit}
      </p>
    </div>
  );
}
