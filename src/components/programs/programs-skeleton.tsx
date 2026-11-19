import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Заглушка розділу Programs: перемикач, список і (на lg+) редактор. */
export function ProgramsSkeleton({ editorOnly = false }: { editorOnly?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5" aria-busy="true" aria-label={useTranslations("common.loading")("programs")}>
      <div className={editorOnly ? "hidden space-y-4 lg:block" : "space-y-4"}>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-12 w-full max-w-sm rounded-full" />
      </div>
      <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
        <div className={editorOnly ? "hidden space-y-3 lg:block" : "space-y-3"}>
          <Skeleton className="h-40 rounded-2xl lg:h-20" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="mt-6 h-6 w-32" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
        <div className={cn("w-full lg:max-w-[880px]", editorOnly ? "space-y-3" : "hidden space-y-3 lg:block")}>
          <Skeleton className="h-9 w-2/3" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-5 w-56" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
          <Skeleton className="h-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}
