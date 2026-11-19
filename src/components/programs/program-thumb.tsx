import Image from "next/image";
import { programInitials } from "@/lib/programs/initials";
import { programImage } from "@/lib/programs/template-images";
import { cn } from "@/lib/utils";

export type ProgramThumbSize = "sm" | "md" | "lg";

const PX: Record<ProgramThumbSize, number> = { sm: 44, md: 56, lg: 72 };
const SIZE_CLASS: Record<ProgramThumbSize, string> = { sm: "size-11", md: "size-14", lg: "size-[72px]" };

/**
 * Мініатюра програми: картинка шаблону (для шаблону — за id, для копії —
 * за source_template_id), інакше плитка з ініціалами (FB / UL / PPL).
 * Розміри: sm 44, md 56, lg 72; className може перевизначити розмір
 * (напр. max-sm:size-12). Фігури на картинках на весь зріст, тому
 * object-position — center 30% (у квадраті видно торс).
 */
export function ProgramThumb({
  program,
  size = "md",
  active = false,
  className,
}: {
  program: { id: string; name: string; sourceTemplateId?: string | null };
  size?: ProgramThumbSize;
  /** Ініціали активної програми — лаймовим. */
  active?: boolean;
  className?: string;
}) {
  const src = programImage(program);
  const box = cn("shrink-0 rounded-2xl", SIZE_CLASS[size], className);

  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center bg-muted font-heading font-bold tracking-wide select-none",
          size === "lg" ? "text-lg" : "text-sm",
          active ? "text-accent-text" : "text-foreground/85",
          box,
        )}
      >
        {programInitials(program.name)}
      </span>
    );
  }

  const px = PX[size];
  return (
    <Image
      src={src}
      alt=""
      width={px}
      height={px}
      className={cn("border border-[#24262B] bg-[#0E0F11] object-cover object-[center_30%]", box)}
    />
  );
}
