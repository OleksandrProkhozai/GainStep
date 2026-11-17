import type { LucideIcon } from "lucide-react";

/** Сторінка-заглушка для розділів, які ще в роботі. */
export function ComingSoon({
  title,
  icon: Icon,
}: {
  title: string;
  icon: LucideIcon;
}) {
  return (
    <section>
      <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
        {title}
      </h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-card px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Icon className="size-7" aria-hidden />
        </span>
        <p className="mt-4 font-heading text-lg font-bold">Coming soon</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          This section is under construction.
        </p>
      </div>
    </section>
  );
}
