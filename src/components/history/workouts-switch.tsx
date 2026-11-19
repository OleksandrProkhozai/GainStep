import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Сегментований перемикач "Сьогодні | Історія" — посилання, а не локальний стан. */
export function WorkoutsSwitch({ active, className }: { active: "today" | "history"; className?: string }) {
  const t = useTranslations("history.switch");
  const items = [
    { id: "today", href: "/workouts" },
    { id: "history", href: "/workouts/history" },
  ] as const;
  return (
    <nav aria-label={t("label")} className={cn("flex w-full max-w-xs rounded-full border border-foreground/10 bg-card p-1", className)}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={cn(
            "flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
            active === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(item.id)}
        </Link>
      ))}
    </nav>
  );
}
