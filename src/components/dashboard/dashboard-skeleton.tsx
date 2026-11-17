import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон дашборду: та сама сітка, що й у справжніх картках. */
export function DashboardSkeleton() {
  return (
    <div aria-hidden className="space-y-4 md:space-y-5">
      <div>
        <Skeleton className="h-8 w-48 md:h-9 md:w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Skeleton className="h-[220px] rounded-2xl md:h-[200px]" />
        <Skeleton className="h-[140px] rounded-2xl md:h-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[112px] rounded-2xl md:h-[128px]" />
        ))}
      </div>
      <Skeleton className="h-[300px] rounded-2xl md:h-[356px]" />
    </div>
  );
}
