import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProgramsWorkspace } from "@/components/programs/programs-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("programs");
  return { title: t("title") };
}

/** Список програм; на lg+ справа — редактор активної програми. */
export default function ProgramsPage() {
  return <ProgramsWorkspace selectedId={null} />;
}
