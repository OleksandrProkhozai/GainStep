import { Trophy } from "lucide-react";
import type { PersonalRecord } from "@/lib/progress/derive";
import { toDisplayWeight, type WeightUnit } from "@/lib/units";
import { Card, CardTitle, formatNumber, shortDate } from "./parts";

/** Рекорд вважається новим упродовж тижня. */
const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ROWS = 5;

/** Найкращий підхід (за оцінкою 1ПМ) кожної вправи; найсвіжіші — зверху. */
export function RecordsCard({
  records,
  unit,
  now,
}: {
  records: PersonalRecord[];
  unit: WeightUnit;
  now: number;
}) {
  const w = (kg: number) => `${formatNumber(toDisplayWeight(kg, unit))} ${unit}`;
  return (
    <Card>
      <header className="flex items-center gap-2">
        <Trophy className="size-5 text-yellow-400" aria-hidden />
        <CardTitle>Personal records</CardTitle>
      </header>

      {records.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
          Your best sets will appear here after the first workout.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {records.slice(0, MAX_ROWS).map((r) => {
            const isNew = now - r.t < NEW_FOR_MS;
            return (
              <li
                key={r.exerciseId}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-3"
              >
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <div className="text-right">
                  <p className="text-sm font-medium whitespace-nowrap">
                    {w(r.weight)} × {r.reps}
                  </p>
                  <p className="text-xs whitespace-nowrap text-muted-foreground">
                    <span className="sr-only">Estimated 1RM </span>
                    {w(r.e1rm)}
                  </p>
                </div>
                <div className="flex w-14 flex-col items-end gap-1">
                  {isNew && (
                    <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] leading-none font-extrabold tracking-wide text-primary-foreground">
                      NEW
                    </span>
                  )}
                  <time className="text-xs whitespace-nowrap text-muted-foreground" dateTime={new Date(r.t).toISOString()}>
                    {shortDate.format(r.t)}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
