"use client";

import { useId, useMemo, useState } from "react";
import { ChartLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { useChartColors } from "@/components/charts/use-chart-colors";
import { useUnit } from "@/components/preferences/preferences-provider";
import { cn } from "@/lib/utils";
import { dateFormat } from "@/lib/dates";
import { formatNumber, toDisplayWeight, unitLabel, type WeightUnit } from "@/lib/units";

export type ChartPoint = {
  /** Час тренування, мс від епохи. */
  t: number;
  /** Оцінка 1ПМ, кг (як у базі). */
  valueKg: number;
};

/** Точка графіка в одиницях користувача. */
type DisplayPoint = { t: number; value: number };

const RANGES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 91 },
  { key: "1Y", days: 366 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_DATE = { day: "numeric", month: "short" } as const;
const LONG_DATE = { weekday: "short", day: "numeric", month: "short", year: "numeric" } as const;

/**
 * Картка "Your progress": оцінка 1ПМ вправи за тренуваннями.
 * `now` приходить із сервера, щоб фільтр діапазону був детермінованим.
 */
export function ProgressChart({
  exerciseName,
  points,
  now,
}: {
  exerciseName: string | null;
  points: ChartPoint[];
  now: number;
}) {
  const unit = useUnit();
  const locale = useLocale();
  const t = useTranslations("dashboard.chart");
  const colors = useChartColors();
  const shortDate = dateFormat(locale, SHORT_DATE);
  const [range, setRange] = useState<RangeKey>("1M");
  const gradientId = useId();

  const visible = useMemo<DisplayPoint[]>(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const from = now - days * DAY_MS;
    return points
      .filter((p) => p.t >= from)
      .map((p) => ({ t: p.t, value: toDisplayWeight(p.valueKg, unit) }));
  }, [points, range, now, unit]);

  const hasAnyData = points.length > 0;

  return (
    <section className="rounded-2xl border border-foreground/10 bg-card p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold">{t("title")}</h2>
          {hasAnyData && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground/90">{exerciseName}</span>
              {" · "}{t("subtitle", { unit: unitLabel(unit, locale) })}
            </p>
          )}
        </div>
        {hasAnyData && (
          <div
            role="radiogroup"
            aria-label={t("range")}
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
                      : "border border-foreground/10 text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  {t(`ranges.${r.key}`)}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="mt-4 h-[220px] md:h-[260px]">
        {!hasAnyData ? (
          <ChartEmpty text={t("empty")} />
        ) : visible.length === 0 ? (
          <ChartEmpty text={t("emptyPeriod")} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={visible}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.fill} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={colors.fill} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={colors.grid}
                strokeDasharray="0"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => shortDate.format(t)}
                tick={{ fill: colors.tick, fontSize: 11 }}
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
                tick={{ fill: colors.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickCount={4}
              />
              <Tooltip
                cursor={{ stroke: colors.cursor, strokeWidth: 1 }}
                content={(props) => <ChartTooltip {...props} unit={unit} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={t("e1rm")}
                stroke={colors.line}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 4, fill: colors.surface, stroke: colors.line, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: colors.line, stroke: colors.surface, strokeWidth: 2 }}
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
  const t = useTranslations("dashboard.chart");
  const locale = useLocale();
  const point = payload?.[0]?.payload as DisplayPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-foreground/10 bg-popover/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <p className="text-[11px] text-muted-foreground">
        {dateFormat(locale, LONG_DATE).format(point.t)}
      </p>
      <p className="mt-0.5 font-heading text-base font-bold text-foreground">
        {formatNumber(point.value, locale)} {unitLabel(unit, locale)}
      </p>
      <p className="text-[11px] text-muted-foreground">{t("e1rm")}</p>
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-foreground/10 px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-accent-text">
        <ChartLine className="size-5" aria-hidden />
      </span>
      <p className="mt-3 max-w-[260px] text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
