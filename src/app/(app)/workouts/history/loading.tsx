import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон історії: та сама сітка, що й на сторінці. */
export default function Loading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[1280px] space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Skeleton className="h-8 w-40 md:h-9" />
        <Skeleton className="h-12 w-full max-w-xs rounded-full" />
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[148px] rounded-[20px] lg:h-[330px]" />
          <Skeleton className="h-9 w-64 rounded-full lg:h-[110px] lg:w-full lg:rounded-[20px]" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 rounded-full" />
          <Skeleton className="mt-2 h-4 w-48" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-[20px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
