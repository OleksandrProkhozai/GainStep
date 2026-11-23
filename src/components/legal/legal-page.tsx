import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/app-shell/logo";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getLegalDocument, LEGAL_UPDATED_AT } from "@/lib/legal/content";

/** Публічна сторінка документа (/privacy, /terms): доступна без входу. */
export async function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const [t, format, rawLocale] = await Promise.all([
    getTranslations("legal"),
    getFormatter(),
    getLocale(),
  ]);
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const doc = getLegalDocument(kind, locale);
  const updated = format.dateTime(new Date(`${LEGAL_UPDATED_AT}T12:00:00Z`), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background pt-[calc(env(safe-area-inset-top)+1.25rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] pl-[calc(env(safe-area-inset-left)+1rem)] text-foreground md:px-10 md:pt-8">
      <div className="flex items-center justify-between gap-4">
        <Logo />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-accent-text hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("home")}
        </Link>
      </div>

      <main className="mx-auto w-full max-w-2xl py-8 md:py-12">
        <h1 className="font-heading text-[28px] leading-tight font-extrabold tracking-tight md:text-4xl">
          {t(kind === "privacy" ? "privacyTitle" : "termsTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("updated", { date: updated })}
        </p>
        <p className="mt-6 text-[15px] leading-relaxed">{doc.intro}</p>

        <div className="mt-8 space-y-7">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-heading text-lg font-extrabold tracking-tight">
                {section.heading}
              </h2>
              {section.paragraphs?.map((p) => (
                <p key={p} className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {section.items && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-muted-foreground marker:text-accent-text">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <nav className="mt-10 flex gap-4 border-t border-border pt-6 text-sm">
          <Link href="/" className="font-medium text-accent-text hover:underline">
            {t("home")}
          </Link>
          <Link
            href={kind === "privacy" ? "/terms" : "/privacy"}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {t(kind === "privacy" ? "termsTitle" : "privacyTitle")}
          </Link>
        </nav>
      </main>
    </div>
  );
}
