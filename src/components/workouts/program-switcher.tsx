"use client";

import Link from "next/link";
import { Check, ChevronDown, LayoutGrid, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActiveProgram, type ActivatableProgram } from "@/components/programs/active-program";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Тренування → Сьогодні: pill «НАЗВА ▾» праворуч від «Почати тренування».
 * Список власних програм (активна — з галочкою) і «Керувати програмами».
 * Вибір робить програму активною (та сама дія, що в розділі Програми);
 * назва в pill змінюється одразу, дні — після відповіді сервера.
 */
export function ProgramSwitcher({ programs, className }: { programs: ActivatableProgram[]; className?: string }) {
  const t = useTranslations("programs.active");
  const { activeId, pending, activate } = useActiveProgram();
  const current = programs.find((p) => p.id === activeId);
  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("switchLabel", { name: current.name })}
        className={buttonVariants({
          variant: "outline-pill",
          size: "xs",
          className: cn("max-w-full px-3 text-[13px]", className),
        })}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        <span className="truncate">{current.name}</span>
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("myPrograms")}</DropdownMenuLabel>
        {programs.map((p) => {
          const selected = p.id === activeId;
          return (
            <DropdownMenuItem
              key={p.id}
              disabled={pending}
              aria-checked={selected}
              role="menuitemradio"
              onSelect={() => {
                if (!selected) activate(p);
              }}
            >
              <Check aria-hidden className={cn(!selected && "invisible")} />
              <span className="line-clamp-2 min-w-0">{p.name}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/programs">
            <LayoutGrid aria-hidden />
            {t("manage")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
