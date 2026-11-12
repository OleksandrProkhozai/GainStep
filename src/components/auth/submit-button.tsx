import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Велика лаймова кнопка-«пігулка» відправки форми зі станом завантаження. */
export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="h-12 w-full md:h-14 gap-2.5 rounded-full bg-[#c6f432] text-base font-bold text-[#0e0f11] hover:bg-[#d4f75c] focus-visible:border-[#c6f432] focus-visible:ring-[#c6f432]/40 active:scale-[0.98] [&_svg:not([class*='size-'])]:size-5"
    >
      {children}
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <ArrowRight aria-hidden />
      )}
    </Button>
  );
}
