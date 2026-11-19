import {
  CalendarDays,
  House,
  LayoutGrid,
  ChartLine,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: "/" | "/workouts" | "/progress" | "/programs" | "/settings";
  /** Ключ підпису: nav.items.{key} (сайдбар) і nav.short.{key} (нижня панель). */
  key: "dashboard" | "workouts" | "progress" | "programs" | "settings";
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "dashboard", icon: House },
  { href: "/workouts", key: "workouts", icon: CalendarDays },
  { href: "/progress", key: "progress", icon: ChartLine },
  { href: "/programs", key: "programs", icon: LayoutGrid },
  { href: "/settings", key: "settings", icon: Settings },
];

/** Розділи, що належать пункту навігації, крім його власного шляху. */
const SECTION_ALIASES: Partial<Record<NavItem["href"], string[]>> = {
  // Бібліотека вправ — частина розділу Programs (перемикач "Programs | Exercises").
  "/programs": ["/exercises"],
};

const matches = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** "/" активний лише на головній; інші — для всіх вкладених сторінок. */
export function isNavActive(pathname: string, href: NavItem["href"]) {
  if (href === "/") return pathname === "/";
  return matches(pathname, href) || (SECTION_ALIASES[href] ?? []).some((alias) => matches(pathname, alias));
}
