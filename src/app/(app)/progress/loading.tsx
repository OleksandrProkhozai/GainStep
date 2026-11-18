import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон сторінки прогресу: та сама сітка, що й у справжніх картках. */
export default function Loading() {
  return (
    <div aria-hidden className="space-y-4 md:space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-8 w-36 md:h-9" />
        <div className="flex flex-col gap-3 md:flex-row">
          <Skeleton className="h-11 w-full rounded-xl md:h-10 md:w-48 md:rounded-full" />
          <Skeleton className="h-10 w-full rounded-full md:w-[260px]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[92px] rounded-2xl md:h-[100px]" />
        ))}
      </div>
      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <Skeleton className="h-[300px] rounded-2xl md:h-[370px]" />
        <Skeleton className="h-[230px] rounded-2xl lg:h-auto" />
        <Skeleton className="h-[230px] rounded-2xl" />
        <Skeleton className="h-[200px] rounded-2xl" />
      </div>
    </div>
  );
}
