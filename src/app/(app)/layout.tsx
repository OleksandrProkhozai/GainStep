import { Suspense } from "react";
import type { Viewport } from "next";
import Link from "next/link";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { Logo } from "@/components/app-shell/logo";
import { Sidebar } from "@/components/app-shell/sidebar";
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
 * lg+: сайдбар 240px. Навігація статична й потрапляє в static shell,
 * а дані користувача підвантажуються в Suspense.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <Sidebar
        footer={
          <Suspense fallback={<SidebarUserSkeleton />}>
            <SidebarUser />
          </Suspense>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col md:pl-[76px] lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-background/85 pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pb-3 pl-[calc(env(safe-area-inset-left)+1rem)] backdrop-blur-xl md:hidden">
          <Link
            href="/"
            aria-label="GainStep — dashboard"
            className="rounded-lg focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Logo />
          </Link>
          <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
            <HeaderUser />
          </Suspense>
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 pt-5 pr-[calc(env(safe-area-inset-right)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] pl-[calc(env(safe-area-inset-left)+1rem)] md:px-6 md:pt-8 md:pb-10 lg:px-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
