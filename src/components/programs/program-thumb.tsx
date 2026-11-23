import Image from "next/image";
import { programInitials } from "@/lib/programs/initials";
import { programThumbSrc } from "@/lib/programs/images";
import { cn } from "@/lib/utils";

export type ProgramThumbSize = "sm" | "md" | "lg";

const PX: Record<ProgramThumbSize, number> = { sm: 44, md: 56, lg: 72 };
const SIZE_CLASS: Record<ProgramThumbSize, string> = { sm: "size-11", md: "size-14", lg: "size-[72px]" };

/**
 * Мініатюра програми: власне фото (bucket program-images) → картинка шаблону
 * (для шаблону — за id, для копії — за source_template_id) → для власної
 * програми картинка за замовчуванням → плитка з ініціалами (FB / UL / PPL).
 * Розміри: sm 44, md 56, lg 72; className може перевизначити розмір
 * (напр. max-sm:size-12). object-position center 30% — для неквадратних
 * фото користувача (у квадраті видно торс).
 */
export function ProgramThumb({
  program,
  size = "md",
  active = false,
  className,
}: {
  program: {
    id: string;
    name: string;
    sourceTemplateId?: string | null;
    /** Шлях фото в bucket program-images. */
    imagePath?: string | null;
    /** false — власна програма (без фото — картинка за замовчуванням). */
    isTemplate?: boolean;
  };
  size?: ProgramThumbSize;
  /** Ініціали активної програми — лаймовим. */
  active?: boolean;
  className?: string;
}) {
  const src = programThumbSrc({ ...program, custom: program.isTemplate === false });
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
      // Фото зі Storage вже стиснуте (512×512) — без оптимізації Next.
      unoptimized={src.startsWith("http")}
      className={cn("border border-[#24262B] bg-[#0E0F11] object-cover object-[center_30%]", box)}
    />
  );
}
