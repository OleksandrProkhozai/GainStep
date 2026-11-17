import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон хабу тренувань: та сама сітка, що й у справжніх блоках. */
export default function Loading() {
  return (
    <div aria-hidden className="space-y-7 md:space-y-9">
      <div>
        <Skeleton className="h-8 w-40 md:h-9" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="grid gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[196px] rounded-2xl" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-44" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
    </div>
  );
}
