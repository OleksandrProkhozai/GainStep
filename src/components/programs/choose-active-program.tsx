"use client";

import Link from "next/link";
import { LayoutGrid, Loader2, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveProgram, type ActivatableProgram } from "./active-program";

/**
 * Порожній стан «Виберіть активну програму»: активної немає (наприклад,
 * її видалили), а власні програми є. Шаблон не підставляється — користувач
 * сам обирає зі своїх програм. Потребує ActiveProgramProvider.
 */
export function ChooseActiveProgram({
  programs,
  className,
  showManage = true,
}: {
  programs: ActivatableProgram[];
  className?: string;
  /** Посилання «Керувати програмами» (на самій сторінці програм не потрібне). */
  showManage?: boolean;
}) {
  const t = useTranslations("programs.active");
  const { activeId, pending, activate } = useActiveProgram();

  return (
    <div className={cn("rounded-2xl border border-foreground/10 bg-card p-5", className)}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-accent-text">
        <Star className="size-6" aria-hidden />
      </span>
      <h2 className="mt-3 font-heading text-lg font-bold">{t("chooseTitle")}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("chooseText")}</p>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("chooseTitle")}>
        {programs.map((p) => {
          const busy = pending && activeId === p.id;
          return (
            <li key={p.id} className="max-w-full">
              <Button
                type="button"
                variant="outline-pill"
                disabled={pending}
                aria-busy={busy}
                aria-label={t("makeActiveNamed", { name: p.name })}
                onClick={() => activate(p)}
                className="h-auto min-h-9 max-w-full py-1.5"
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Star aria-hidden />}
                <span className="line-clamp-2 min-w-0 text-left leading-tight whitespace-normal">{p.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
      {showManage && (
        <Link
          href="/programs"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-3 -ml-2 rounded-full text-muted-foreground" })}
        >
          <LayoutGrid aria-hidden />
          {t("manage")}
        </Link>
      )}
    </div>
  );
}
