import { Suspense } from "react";
import type { Viewport } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BottomNav, BottomNavView } from "@/components/app-shell/bottom-nav";
import { Logo } from "@/components/app-shell/logo";
import { Sidebar, SidebarView } from "@/components/app-shell/sidebar";
import { UserPreferences } from "@/components/preferences/user-preferences";
import {
  HeaderUser,
  SidebarUser,
  SidebarUserSkeleton,
} from "@/components/app-shell/user";
import { Skeleton } from "@/components/ui/skeleton";

// viewport-fit=cover — щоб env(safe-area-inset-*) працював на iPhone
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0e0f11",
};

/**
 * Каркас застосунку (усі сторінки після входу й онбордингу).
 * Телефон (<md): шапка зверху + нижня панель. md–lg: вузький сайдбар.
 * lg+: сайдбар 240px. Навігація читає usePathname(), тому вона в Suspense:
 * на статичних маршрутах шлях відомий при пререндері й fallback не видно,
 * а на динамічних (/programs/[id]) у static shell — навігація без
 * підсвічування, яку одразу замінює справжня. Дані користувача — теж у Suspense.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const t = useTranslations("nav");
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <Suspense fallback={<SidebarView pathname={null} footer={<SidebarUserSkeleton />} />}>
        <Sidebar
          footer={
            <Suspense fallback={<SidebarUserSkeleton />}>
              <SidebarUser />
            </Suspense>
          }
        />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col md:pl-[76px] lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pb-3 pl-[calc(env(safe-area-inset-left)+1rem)] backdrop-blur-xl md:hidden">
          <Link
            href="/"
            aria-label={t("homeLink")}
            className="rounded-lg focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Logo />
          </Link>
          <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
            <HeaderUser />
          </Suspense>
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 pt-5 pr-[calc(env(safe-area-inset-right)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] pl-[calc(env(safe-area-inset-left)+1rem)] md:px-6 md:pt-8 md:pb-10 lg:px-10">
          {/* Налаштування (unit, таймер) для клієнтських компонентів; promise
              створюється всередині Suspense, сторінка не чекає на нього. */}
          <Suspense>
            <UserPreferences>{children}</UserPreferences>
          </Suspense>
        </main>
      </div>

      <Suspense fallback={<BottomNavView pathname={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
