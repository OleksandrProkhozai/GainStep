import { format, parseISO } from "date-fns";
import { formatMinutes, toTimeKey } from "@/lib/dates";
import { exerciseName } from "@/lib/i18n/names";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { formatNumber, kgToUnit, unitLabel, type WeightUnit } from "@/lib/units";
import type { HistoryExercise } from "@/lib/history/derive";

/** Блок дати картки: { day: "19", month: "ЛИС" } / { "19", "NOV" }. */
export function dateBlock(dayKey: string, locale: string) {
  const date = parseISO(dayKey);
  const month = format(date, "LLL", { locale: dateFnsLocale(locale) }).replace(".", "").slice(0, 3);
  return { day: format(date, "d"), month: month.toLocaleUpperCase(locale) };
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** "Четвер, 19 листопада · 18:10" / "Thursday, 19 November · 18:10". */
export function longDateTime(startedAt: string, dayKey: string, locale: string) {
  const date = format(parseISO(dayKey), "EEEE, d MMMM", { locale: dateFnsLocale(locale) });
  return `${capitalize(date)} · ${toTimeKey(startedAt)}`;
}

/** "19 лист." / "19 Nov" — коротка дата для списків. */
export function shortDate(dayKey: string, locale: string) {
  return format(parseISO(dayKey), "d MMM", { locale: dateFnsLocale(locale) });
}

/** Заголовок тижня з діапазоном: "10–16 листопада" або "27 жовтня – 2 листопада". */
export function weekRange(start: string, end: string, locale: string) {
  const l = { locale: dateFnsLocale(locale) };
  const a = parseISO(start);
  const b = parseISO(end);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${format(a, "d", l)}–${format(b, "d MMMM", l)}`;
  return `${format(a, "d MMMM", l)} – ${format(b, "d MMMM", l)}`;
}

/** "Листопад 2026" / "November 2026". */
export function monthTitle(month: string, locale: string) {
  return capitalize(format(parseISO(`${month}-01`), "LLLL yyyy", { locale: dateFnsLocale(locale) }));
}

/** "1 год 05 хв"; без finished_at — "—". */
export function durationText(minutes: number | null, locale: string) {
  return minutes === null ? "—" : formatMinutes(minutes, locale);
}

/** Тоннаж повністю: "8 450 кг" (у картці, без скорочення k). */
export function volumeText(kg: number, unit: WeightUnit, locale: string) {
  return `${formatNumber(Math.round(kgToUnit(kg, unit)), locale)} ${unitLabel(unit, locale)}`;
}

/** Рядок вправ: перші `limit` назв і решта числом. */
export function exercisesPreview(exercises: readonly HistoryExercise[], locale: string, limit = 3) {
  const names = exercises.map((e) => exerciseName(e, locale));
  return { names: names.slice(0, limit), more: Math.max(0, names.length - limit) };
}
