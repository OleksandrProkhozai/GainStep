"use client";

import { ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { IMAGE_UPLOAD } from "@/lib/images/storage";
import { cn } from "@/lib/utils";

/**
 * Блок вибору фото: прев'ю (мініатюра сутності), «Завантажити / Змінити
 * фото», «Стандартне фото» і підказка про формати. Стан — useImageDraft.
 */
export function ImagePicker({
  preview,
  hasImage,
  uploading,
  onPick,
  onReset,
  className,
}: {
  /** Мініатюра з поточним фото або картинкою за замовчуванням (заповнює квадрат 96px). */
  preview: React.ReactNode;
  /** Є власне фото (показати «Стандартне фото»). */
  hasImage: boolean;
  uploading: boolean;
  onPick: (file: File | undefined) => void;
  onReset: () => void;
  className?: string;
}) {
  const t = useTranslations("common.photo");
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative size-24 shrink-0">
        {preview}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70">
            <Loader2 className="size-6 animate-spin text-accent-text" aria-hidden />
          </span>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">{t("label")}</p>
        <div className="flex flex-wrap gap-2">
          <label
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold transition hover:border-foreground/30 focus-within:ring-3 focus-within:ring-primary/30",
              uploading && "pointer-events-none opacity-50",
            )}
          >
            <ImagePlus className="size-4" aria-hidden />
            {hasImage ? t("change") : t("upload")}
            <input
              type="file"
              accept={IMAGE_UPLOAD.accept.join(",")}
              disabled={uploading}
              className="sr-only"
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {hasImage && (
            <button
              type="button"
              onClick={onReset}
              disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t("reset")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
    </div>
  );
}
