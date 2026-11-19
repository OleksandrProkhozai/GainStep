import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Заглушка екрана підсумку: ті самі картки й порядок, що й на сторінці. */
export function SummarySkeleton() {
  const card = "rounded-2xl";
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label={useTranslations("common.loading")("summary")}>
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:px-6 lg:pt-5">
        <Skeleton className="hidden h-8 w-36 lg:block" />
        <Skeleton className="ml-auto size-10 rounded-full" />
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 pt-3 pb-6 lg:grid lg:max-w-[1240px] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:px-6 xl:gap-5">
        <div className="flex flex-col gap-3 lg:gap-4 xl:gap-5">
          <Skeleton className={`h-64 ${card}`} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className={`h-28 ${card}`} />
            ))}
          </div>
          <Skeleton className={`h-56 ${card}`} />
          <Skeleton className={`hidden h-24 lg:block ${card}`} />
        </div>
        <div className="flex flex-col gap-3 lg:gap-4 xl:gap-5">
          <Skeleton className={`h-80 ${card}`} />
          <Skeleton className={`h-28 ${card}`} />
          <Skeleton className="hidden h-12 rounded-full lg:block" />
          <Skeleton className="hidden h-12 rounded-full lg:block" />
        </div>
      </div>
    </div>
  );
}
