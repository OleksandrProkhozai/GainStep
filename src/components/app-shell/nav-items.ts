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
  /** Підпис у сайдбарі. */
  label: string;
  /** Коротший підпис у нижній панелі на телефоні. */
  shortLabel: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", shortLabel: "Home", icon: House },
  { href: "/workouts", label: "Workouts", shortLabel: "Workouts", icon: CalendarDays },
  { href: "/progress", label: "Progress", shortLabel: "Progress", icon: ChartLine },
  { href: "/programs", label: "Programs", shortLabel: "Programs", icon: LayoutGrid },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];

/** "/" активний лише на головній; інші — для всіх вкладених сторінок. */
export function isNavActive(pathname: string, href: NavItem["href"]) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
