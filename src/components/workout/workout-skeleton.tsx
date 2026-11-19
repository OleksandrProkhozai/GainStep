import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Заглушка екрана тренування (завантаження даних і стану з localStorage). */
export function WorkoutSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label={useTranslations("common.loading")("workout")}>
      <div className="flex items-center justify-between gap-4 border-b border-foreground/5 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 lg:px-6 lg:py-5">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-8 w-40 lg:h-11 lg:w-48" />
        <Skeleton className="size-9 rounded-full lg:h-11 lg:w-40" />
      </div>
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)_240px] lg:items-start xl:grid-cols-[300px_minmax(0,1fr)_300px] xl:gap-5 xl:p-5">
        <Skeleton className="hidden h-96 rounded-2xl lg:block" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3 lg:h-28 lg:w-full lg:rounded-2xl" />
          <Skeleton className="h-11 w-56 rounded-full" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <Skeleton className="hidden h-96 rounded-2xl lg:block" />
      </div>
    </div>
  );
}
