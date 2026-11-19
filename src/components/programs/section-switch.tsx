import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Сегментований перемикач "Programs | Exercises" — це посилання, а не локальний стан. */
export function SectionSwitch({
  active,
  className,
}: {
  active: "programs" | "exercises";
  className?: string;
}) {
  const items = [
    { id: "programs", href: "/programs" },
    { id: "exercises", href: "/exercises" },
  ] as const;
  const t = useTranslations("programs.switch");
  return (
    <nav aria-label={t("label")} className={cn("flex w-full max-w-sm rounded-full bg-foreground/6 p-1", className)}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={cn(
            "flex h-10 flex-1 items-center justify-center rounded-full text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
            active === item.id ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:text-foreground",
          )}
        >
          {t(item.id)}
        </Link>
      ))}
    </nav>
  );
}
