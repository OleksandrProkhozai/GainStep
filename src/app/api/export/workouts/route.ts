import { getTranslations } from "next-intl/server";
import { getRequestLocale } from "@/i18n/locale";
import { getSession } from "@/lib/auth/session";
import { toDayKey } from "@/lib/dates";
import { buildExportRows, exportFileName } from "@/lib/history/export";
import { monthBounds, monthOf, parseDayParam } from "@/lib/history/month";
import { loadHistoryWorkouts } from "@/lib/history/queries";
import { buildWorkbook, XLSX_TYPE } from "@/lib/history/xlsx";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/export/workouts?from=YYYY-MM-DD&to=YYYY-MM-DD → .xlsx.
 * Без параметрів — усі тренування. Лише для залогіненого користувача;
 * дані — через його сесію (RLS), без service_role.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = parseDayParam(fromParam);
  const to = parseDayParam(toParam);
  if ((fromParam && !from) || (toParam && !to) || (from && to && from > to)) {
    return new Response("Bad request", { status: 400 });
  }

  const [supabase, locale] = await Promise.all([createClient(), getRequestLocale()]);
  const [t, tm] = await Promise.all([
    getTranslations({ locale, namespace: "history.export" }),
    getTranslations({ locale, namespace: "common.enums.muscle" }),
  ]);

  const today = toDayKey(new Date());
  const last = to ?? today;
  try {
    const { workouts } = await loadHistoryWorkouts(supabase, session.id, { first: from, last }, locale);

    const sheets = buildExportRows(workouts, {
      unit: session.unit,
      locale,
      labels: {
        workouts: {
          date: t("columns.date"),
          day: t("columns.day"),
          duration: t("columns.duration"),
          sets: t("columns.sets"),
          volume: t("columns.volume"),
          records: t("columns.records"),
          notes: t("columns.notes"),
        },
        sets: {
          date: t("columns.date"),
          exercise: t("columns.exercise"),
          muscle: t("columns.muscle"),
          set: t("columns.set"),
          weight: t("columns.weight"),
          reps: t("columns.reps"),
          e1rm: t("columns.e1rm"),
          completed: t("columns.completed"),
        },
        records: {
          exercise: t("columns.exercise"),
          result: t("columns.result"),
          e1rm: t("columns.e1rm"),
          date: t("columns.date"),
        },
        yes: t("yes"),
        no: t("no"),
        muscle: (group) => (tm.has(group as never) ? tm(group as never) : group),
      },
    });

    const buffer = await buildWorkbook(
      sheets,
      { workouts: t("sheets.workouts"), sets: t("sheets.sets"), records: t("sheets.records") },
      locale,
    );
    // Один календарний місяць → gainstep-workouts-2026-11.xlsx, інакше — all.
    const singleMonth = from && to && monthOf(from) === monthOf(to) && monthBounds(monthOf(from)).first === from ? monthOf(from) : null;
    const fileName = exportFileName(singleMonth);

    return new Response(buffer, {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("export workouts", error);
    return new Response("Export failed", { status: 500 });
  }
}
