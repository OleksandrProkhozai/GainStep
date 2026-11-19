"use client";

import { useId, useState } from "react";
import { parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { useDateFns } from "@/components/i18n/use-format";
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
import { useChartColors } from "@/components/charts/use-chart-colors";
import { useUnit } from "@/components/preferences/preferences-provider";
import type { WeightUnit } from "@/lib/units";
import { LogWeightDialog } from "./log-weight-dialog";
import { Card, CardTitle, Delta, useProgressFormat } from "./parts";
import { WeightHistory } from "./weight-history";

type Point = { t: number; value: number };

/**
 * Картка "Body weight": остання вага, зміна за вибраний на сторінці
 * період і графік записів періоду. Запис, редагування й видалення —
 * через діалоги "Log weight" та "History".
 */
export function BodyWeightCard({
  entries,
  periodFrom,
}: {
  /** Усі записи, від старих до нових. */
  entries: BodyWeightEntry[];
  /** Початок вибраного періоду, мс; null — уся історія. */
  periodFrom: number | null;
}) {
  const unit = useUnit();
  const t = useTranslations("progress.bodyWeight");
  const pf = useProgressFormat();
  const fmtDate = useDateFns();
  const unitText = pf.unit(unit);
  const colors = useChartColors();
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
        <CardTitle>{t("title")}</CardTitle>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <History className="size-3.5" aria-hidden />
              {t("history")}
            </button>
          )}
          <button
            type="button"
            onClick={() => openLog(null)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-foreground/15 px-3 text-xs font-semibold transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden />
            {t("log")}
          </button>
        </div>
      </header>

      {latest && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className="font-heading text-2xl font-extrabold tracking-tight md:text-[28px]">
            {pf.number(toBodyUnit(latest.weightKg, unit))}
            <span className="ml-1 text-sm font-semibold text-muted-foreground">{unitText}</span>
          </p>
          {delta !== null && since && (
            <span className="inline-flex items-baseline gap-1.5">
              <Delta value={delta} text={`${pf.signed(delta)} ${unitText}`} zeroText={`= 0 ${unitText}`} neutralDown />
              <span className="text-xs text-muted-foreground">{t("vs", { date: fmtDate(parseISO(since), "short") })}</span>
            </span>
          )}
        </div>
      )}

      {points.length < 2 ? (
        <div className="mt-3 flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-foreground/10 px-5 py-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-accent-text">
            <Scale className="size-5" aria-hidden />
          </span>
          <p className="mt-2.5 max-w-[240px] text-sm text-muted-foreground">
            {t("empty")}
          </p>
        </div>
      ) : (
        <div className="mt-2 min-h-[150px] flex-1">
          <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.fill} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={colors.fill} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(time: number) => fmtDate(time, "short")}
                tick={{ fill: colors.tick, fontSize: 10 }}
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
                tick={{ fill: colors.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={30}
                tickCount={3}
              />
              <Tooltip
                cursor={{ stroke: colors.cursor, strokeWidth: 1 }}
                content={(props) => <WeightTooltip {...props} unit={unit} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={t("title")}
                stroke={colors.line}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 3, fill: colors.line, stroke: colors.surface, strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: colors.line, stroke: colors.surface, strokeWidth: 2 }}
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
        initialDate={log.date}
      />
      <WeightHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entries={entries}
        onEdit={(date) => {
          setHistoryOpen(false);
          openLog(date);
        }}
      />
    </Card>
  );
}

function WeightTooltip({ active, payload, unit }: TooltipContentProps & { unit: WeightUnit }) {
  const pf = useProgressFormat();
  const fmtDate = useDateFns();
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-foreground/10 bg-popover/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <p className="text-[11px] text-muted-foreground">{fmtDate(point.t, "weekday")}</p>
      <p className="mt-0.5 font-heading text-base font-bold text-foreground">
        {pf.number(point.value)} {pf.unit(unit)}
      </p>
    </div>
  );
}
