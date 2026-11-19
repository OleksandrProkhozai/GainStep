import Link from "next/link";
import { ArrowLeft, Dumbbell, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/**
 * 404 у стилі застосунку. `fullPage` — для неіснуючих URL (без каркаса
 * застосунку): на весь екран і з логотипом. Інакше — блок усередині каркаса
 * (notFound() на сторінках розділів, напр. чужа програма).
 */
export function NotFoundView({ fullPage = false }: { fullPage?: boolean }) {
  const t = useTranslations("common.notFound");

  const content = (
    <div className="relative flex flex-col items-center text-center">
      {/* Великий "404" з гантелею замість нуля */}
      <p
        aria-hidden
        className="flex items-center font-heading text-[88px] leading-none font-extrabold tracking-tighter text-foreground md:text-[120px]"
      >
        4
        <span className="mx-1 flex size-[76px] items-center justify-center rounded-full bg-primary/12 md:size-[104px]">
          <Dumbbell className="size-10 rotate-45 text-accent-text md:size-14" strokeWidth={2.5} />
        </span>
        4
      </p>
      <h1 className="mt-6 font-heading text-2xl font-extrabold tracking-tight md:text-[28px]">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">{t("text")}</p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button asChild size="lg" className="sm:min-w-44">
          <Link href="/">
            <ArrowLeft aria-hidden />
            {t("home")}
          </Link>
        </Button>
        <Button asChild variant="outline-pill" size="lg" className="sm:min-w-44">
          <Link href="/programs">
            <LayoutGrid aria-hidden />
            {t("programs")}
          </Link>
        </Button>
      </div>
    </div>
  );

  if (!fullPage) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center rounded-3xl border border-foreground/10 bg-card px-6 py-14">
        {content}
      </section>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-1 flex-col bg-background text-foreground",
        "pt-[calc(env(safe-area-inset-top)+1.25rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pl-[calc(env(safe-area-inset-left)+1rem)] md:px-10 md:pt-8",
      )}
    >
      <Link
        href="/"
        aria-label="GainStep"
        className="self-start rounded-lg focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <Logo />
      </Link>
      <main className="flex flex-1 items-center justify-center py-10">{content}</main>
    </div>
  );
}
