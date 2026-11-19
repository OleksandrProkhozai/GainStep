"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { ImagePicker } from "@/components/images/image-picker";
import { useImageDraft } from "@/components/images/use-image-draft";
import { Button } from "@/components/ui/button";
import { setProgramImage } from "@/lib/programs/actions";
import { PROGRAM_IMAGES_BUCKET } from "@/lib/programs/images";
import { ProgramThumb } from "./program-thumb";
import { ResponsiveModal } from "./responsive-modal";

type ProgramForPhoto = { id: string; name: string; sourceTemplateId: string | null; imagePath: string | null };

/**
 * Фото власної програми: завантажити своє або повернути стандартне
 * (копія шаблону — картинка шаблону, інакше — фото за замовчуванням).
 * Десктоп — Dialog, телефон — нижній лист.
 */
export function ProgramPhotoDialog({
  open,
  onOpenChange,
  program,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: ProgramForPhoto;
}) {
  const t = useTranslations("programs.photo");
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={t("dialogTitle")} description={t("dialogDescription")}>
      {/* Монтується при кожному відкритті: незбережене фото прибирається при закритті. */}
      {open && <PhotoForm program={program} onDone={() => onOpenChange(false)} />}
    </ResponsiveModal>
  );
}

function PhotoForm({ program, onDone }: { program: ProgramForPhoto; onDone: () => void }) {
  const t = useTranslations("programs.photo");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const image = useImageDraft(PROGRAM_IMAGES_BUCKET, program.imagePath);
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (image.path === program.imagePath) return onDone();
    startTransition(async () => {
      const result = await setProgramImage(program.id, image.path);
      if (!result.ok) {
        image.setError(result.error);
        return;
      }
      image.commit();
      toast.success(t("saved"));
      onDone();
    });
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-3 px-4 pb-2 lg:px-5">
        <ImagePicker
          preview={
            <ProgramThumb
              program={{ ...program, imagePath: image.path, isTemplate: false }}
              size="lg"
              className="size-24"
            />
          }
          hasImage={image.path !== null}
          uploading={image.uploading}
          onPick={(file) => void image.pick(file)}
          onReset={image.reset}
        />
        {image.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorText(image.error)}
          </p>
        )}
      </div>
      <div className="flex gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:px-5 lg:pb-5">
        <Button type="button" variant="outline-pill" onClick={onDone} className="flex-1">
          {tc("cancel")}
        </Button>
        <Button type="button" onClick={save} disabled={pending || image.uploading} aria-busy={pending} className="flex-1">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
