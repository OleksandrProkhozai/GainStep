import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProgramsWorkspace } from "@/components/programs/programs-workspace";
import { OFFER_ACTIVATE_PARAM } from "@/lib/programs/active";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("programs");
  return { title: t("program") };
}

/**
 * Редактор програми (шаблон — лише перегляд). Чужа або неіснуюча → 404.
 * ?new=1 — щойно створена програма, що не стала активною: після першого
 * збереження редактор запропонує зробити її активною.
 */
export default async function ProgramPage({ params, searchParams }: PageProps<"/programs/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(id).success) notFound();
  return <ProgramsWorkspace selectedId={id} offerActivate={query[OFFER_ACTIVATE_PARAM] === "1"} />;
}
