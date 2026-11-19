"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavActive } from "./nav-items";

/** Нижня панель навігації на телефоні (<md), з урахуванням safe-area. */
export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}

/** pathname = null — без підсвічування (fallback у Suspense). */
export function BottomNavView({ pathname }: { pathname: string | null }) {
  const t = useTranslations("nav");

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-sidebar/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname !== null && isNavActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none font-medium tracking-tight whitespace-nowrap transition-colors focus-visible:bg-foreground/5 focus-visible:outline-none",
                  active ? "text-accent-text" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {t(`short.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
