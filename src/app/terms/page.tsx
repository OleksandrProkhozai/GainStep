import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("termsTitle") };
}

/** Публічна сторінка (без входу) — потрібна для екрана згоди Google OAuth. */
export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
