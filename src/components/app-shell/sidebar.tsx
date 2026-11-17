"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_ITEMS, isNavActive } from "./nav-items";

/**
 * Сайдбар: md–lg — вузький (лише іконки з підказками), lg+ — 240px з підписами.
 * На телефоні (<md) прихований — там нижня панель.
 * `footer` — картка користувача (серверний компонент у Suspense).
 */
export function Sidebar({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col border-r border-white/10 bg-[#121316] px-3 py-6 md:flex lg:w-60 lg:px-4">
      <Link
        href="/"
        aria-label="GainStep — dashboard"
        className="mb-8 flex justify-center rounded-lg focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none lg:justify-start lg:px-3"
      >
        <Logo compact className="lg:hidden" />
        <Logo className="hidden lg:flex" />
      </Link>

      <TooltipProvider>
        <nav aria-label="Main" className="flex flex-col gap-1.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-11 items-center justify-center gap-3 rounded-xl text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none lg:justify-start lg:px-3",
                      active
                        ? "bg-primary/12 text-primary ring-1 ring-primary/15"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="sr-only lg:not-sr-only">{label}</span>
                    {active && (
                      <span
                        aria-hidden
                        className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/70 lg:static lg:ml-auto"
                      />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="lg:hidden">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>

      <div className="mt-auto">{footer}</div>
    </aside>
  );
}
