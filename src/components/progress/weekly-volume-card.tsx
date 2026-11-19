"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, type TooltipContentProps } from "recharts";
import { percentChange, type WeekVolume } from "@/lib/progress/derive";
import { useTranslations } from "next-intl";
import { formatVolume, kgToUnit, type WeightUnit } from "@/lib/units";
import { useChartColors } from "@/components/charts/use-chart-colors";
import { useUnit } from "@/components/preferences/preferences-provider";
import { Card, CardTitle, Delta, useProgressFormat } from "./parts";

type BarPoint = { label: string; value: number; volumeKg: number };

/** Тоннаж за останні тижні; поточний тиждень — яскравим стовпчиком. */
export function WeeklyVolumeCard({ weeks }: { weeks: WeekVolume[] }) {
  const unit = useUnit();
  const t = useTranslations("progress.volume");
  const pf = useProgressFormat();
  const colors = useChartColors();
  const current = weeks.at(-1)?.volumeKg ?? 0;
  const previous = weeks.at(-2)?.volumeKg ?? 0;
  const change = percentChange(current, previous);
  const total = formatVolume(current, unit, pf.locale);
  const data: BarPoint[] = weeks.map((w) => ({
    label: pf.dayKey(w.week),
    value: Math.round(kgToUnit(w.volumeKg, unit)),
    volumeKg: w.volumeKg,
  }));
  const empty = weeks.every((w) => w.volumeKg === 0);

  return (
    <Card className="flex flex-col">
      <CardTitle>{t("title")}</CardTitle>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p className="font-heading text-2xl font-extrabold tracking-tight md:text-[28px]">
          {total.value}
          <span className="ml-1 text-sm font-semibold text-muted-foreground">{total.unit}</span>
        </p>
        {change !== null && (
          <span className="inline-flex items-baseline gap-1.5">
            <Delta value={change} text={`${pf.signed(change)}%`} />
            <span className="hidden text-xs text-muted-foreground sm:inline">{t("vsLastWeek")}</span>
          </span>
        )}
      </div>

      <div className="mt-3 min-h-[130px] flex-1">
        {empty ? (
          <p className="flex h-full items-center justify-center rounded-xl border border-dashed border-foreground/10 px-4 text-center text-sm text-muted-foreground">
            No training volume in the last {weeks.length} weeks
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={130}>
            <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} accessibilityLayer>
              <XAxis
                dataKey="label"
                tick={{ fill: colors.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: colors.grid }}
                content={(props) => <VolumeTooltip {...props} unit={unit} />}
              />
              <Bar dataKey="value" name={t("series")} radius={[5, 5, 2, 2]} maxBarSize={36} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={d.label} fill={colors.fill} fillOpacity={i === data.length - 1 ? 1 : 0.55} />
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
  const t = useTranslations("progress.volume");
  const pf = useProgressFormat();
  const point = payload?.[0]?.payload as BarPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-foreground/10 bg-popover/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <p className="text-[11px] text-muted-foreground">{t("weekOf", { date: point.label })}</p>
      <p className="mt-0.5 font-heading text-base font-bold text-foreground">
        {pf.number(point.value)} {pf.unit(unit)}
      </p>
    </div>
  );
}
