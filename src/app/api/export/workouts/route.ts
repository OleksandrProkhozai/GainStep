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
  const [t, tm, te] = await Promise.all([
    getTranslations({ locale, namespace: "history.export" }),
    getTranslations({ locale, namespace: "common.enums.muscle" }),
    getTranslations({ locale, namespace: "common.enums.equipment" }),
  ]);

  const today = toDayKey(new Date());
  const last = to ?? today;
  try {
    const { workouts } = await loadHistoryWorkouts(supabase, session.id, { first: from, last }, locale);

    const sheets = buildExportRows(workouts, {
      unit: session.unit,
      locale,
      labels: {
        journal: {
          date: t("columns.date"),
          day: t("columns.day"),
          exercise: t("columns.exercise"),
          muscle: t("columns.muscle"),
          equipment: t("columns.equipment"),
          set: t("columns.set"),
          weight: t("columns.weight"),
          reps: t("columns.reps"),
          setVolume: t("columns.setVolume"),
          e1rm: t("columns.e1rm"),
          record: t("columns.record"),
          completed: t("columns.completed"),
          notes: t("columns.workoutNotes"),
        },
        workouts: {
          date: t("columns.date"),
          day: t("columns.day"),
          duration: t("columns.duration"),
          exercises: t("columns.exercises"),
          sets: t("columns.sets"),
          volume: t("columns.volume"),
          heaviest: t("columns.heaviest"),
          records: t("columns.records"),
          notes: t("columns.notes"),
        },
        records: {
          exercise: t("columns.exercise"),
          result: t("columns.result"),
          e1rm: t("columns.e1rm"),
          date: t("columns.date"),
        },
        exercises: {
          exercise: t("columns.exercise"),
          first: t("columns.firstWorkout"),
          last: t("columns.lastDate"),
          workouts: t("columns.workoutsCount"),
          best: t("columns.bestSet"),
          bestE1rm: t("columns.bestE1rm"),
          startWeight: t("columns.startWeight"),
          currentWeight: t("columns.currentWeight"),
          gain: t("columns.gain"),
          gainPct: t("columns.gainPct"),
        },
        yes: t("yes"),
        no: t("no"),
        recordMark: t("recordMark"),
        muscle: (group) => (tm.has(group as never) ? tm(group as never) : group),
        equipment: (eq) => (te.has(eq as never) ? te(eq as never) : eq),
      },
    });

    const buffer = await buildWorkbook(
      sheets,
      {
        journal: t("sheets.journal"),
        workouts: t("sheets.workouts"),
        records: t("sheets.records"),
        exercises: t("sheets.exercises"),
      },
      locale,
      { total: t("total") },
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
