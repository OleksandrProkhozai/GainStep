"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Іконка "i" біля рекомендації ваги: по тапу / кліку — popover "Чому така
 * вага?" з поясненням (explainSuggestion). На телефоні — тап, без hover.
 */
export function WhyWeight({ text, className }: { text: string; className?: string }) {
  const t = useTranslations("common.suggestion");
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("why")}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
          className,
        )}
      >
        <Info className="size-[18px]" aria-hidden />
      </PopoverTrigger>
      <PopoverContent collisionPadding={12} className="w-80 max-w-[calc(100vw-1.5rem)] text-sm leading-relaxed">
        <p className="font-semibold">{t("why")}</p>
        <p className="mt-1 text-muted-foreground">{text}</p>
      </PopoverContent>
    </Popover>
  );
}
