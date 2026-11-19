"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { muscleImage } from "@/lib/exercises/muscles";
import { cn } from "@/lib/utils";
import { MuscleTile } from "./muscle-tile";

export type ThumbSize = "sm" | "md" | "lg";

const PX: Record<Exclude<ThumbSize, "lg">, number> = { sm: 36, md: 48 };

/**
 * Мініатюра вправи. Пріоритет:
 *   1) exercise.imagePath — власне фото вправи (колонки image_path у базі
 *      поки немає; поле зарезервоване);
 *   2) картинка групи м'язів з public/muscles;
 *   3) MuscleTile з кодом групи — якщо картинка не завантажилась.
 * Розміри: sm 36, md 48, lg — квадрат на всю ширину батька.
 */
export function ExerciseThumb({
  exercise,
  size = "md",
  className,
}: {
  exercise: { muscleGroup: string; imagePath?: string | null };
  size?: ThumbSize;
  className?: string;
}) {
  const tm = useTranslations("common.enums.muscle");
  const [failed, setFailed] = useState<string | null>(null);

  const src = exercise.imagePath || muscleImage(exercise.muscleGroup);
  const key = exercise.muscleGroup as Parameters<typeof tm>[0];
  const alt = tm.has(key) ? tm(key) : exercise.muscleGroup;

  // Помилка завантаження саме цього src → плитка з кодом групи.
  if (failed === src) {
    return size === "lg" ? (
      <span className={cn("flex aspect-square w-full items-center justify-center rounded-2xl border border-[#24262B] bg-muted", className)}>
        <MuscleTile group={exercise.muscleGroup} className="size-16 text-xl" />
      </span>
    ) : (
      <MuscleTile group={exercise.muscleGroup} size={size === "sm" ? "sm" : "md"} className={cn(size === "md" && "size-12", className)} />
    );
  }

  const frame = "shrink-0 overflow-hidden rounded-2xl border border-[#24262B] bg-[#0e0f11] object-cover";

  if (size === "lg") {
    return (
      <span className={cn("relative block aspect-square w-full", frame, className)}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 220px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
          onError={() => setFailed(src)}
        />
      </span>
    );
  }

  const px = PX[size];
  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      className={cn(frame, size === "sm" ? "size-9" : "size-12", className)}
      onError={() => setFailed(src)}
    />
  );
}
