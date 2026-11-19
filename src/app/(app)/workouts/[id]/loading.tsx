import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон сторінки тренування. */
export default function Loading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-3xl">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="mx-auto h-6 w-40 md:mx-0" />
          <Skeleton className="mx-auto h-4 w-56 md:mx-0" />
        </div>
        <Skeleton className="size-11 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 md:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl md:h-20" />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}
