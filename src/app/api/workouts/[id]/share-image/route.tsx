import { ImageResponse } from "next/og";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { loadShareFonts, SHARE_IMAGE_SIZE, ShareCard, shareCardData } from "@/components/history/share-card";
import { getRequestLocale } from "@/i18n/locale";
import { getSession } from "@/lib/auth/session";
import { loadHistoryWorkout } from "@/lib/history/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/workouts/[id]/share-image → PNG 1080×1350 для "Поділитися".
 * Лише власне завершене тренування (сесія користувача + RLS).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/workouts/[id]/share-image">) {
  const { id } = await ctx.params;
  if (!z.guid().safeParse(id).success) return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const [supabase, locale] = await Promise.all([createClient(), getRequestLocale()]);
  const result = await loadHistoryWorkout(supabase, session.id, id, locale);
  if (result.kind !== "ok") return new Response("Not found", { status: 404 });

  const [t, fonts] = await Promise.all([getTranslations({ locale, namespace: "history.share.image" }), loadShareFonts()]);
  const data = shareCardData(result.workout, session.unit, locale, {
    duration: t("duration"),
    volume: t("volume"),
    sets: t("sets"),
    best: t("best"),
    records: (count) => t("records", { count }),
  });

  return new ImageResponse(<ShareCard data={data} />, {
    ...SHARE_IMAGE_SIZE,
    fonts,
    headers: { "Cache-Control": "private, no-store" },
  });
}
