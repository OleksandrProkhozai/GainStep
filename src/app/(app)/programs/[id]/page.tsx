import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProgramsWorkspace } from "@/components/programs/programs-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("programs");
  return { title: t("program") };
}

/** Редактор програми (шаблон — лише перегляд). Чужа або неіснуюча → 404. */
export default async function ProgramPage({ params }: PageProps<"/programs/[id]">) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  return <ProgramsWorkspace selectedId={id} />;
}
