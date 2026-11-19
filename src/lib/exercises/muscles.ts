import type { MuscleGroup } from "./catalog";

/**
 * Кольорові родини груп м'язів для плиток MuscleTile.
 * Лаймовий (#C6F432) тут свідомо не використовуємо — він лише для дій.
 */
export const MUSCLE_FAMILY_COLORS = {
  chest: "#FF8A65",
  back: "#64B5F6",
  legs: "#B39DDB",
  shoulders: "#FFD54F",
  arms: "#4DD0E1",
  core: "#F48FB1",
  other: "#8A8F98",
} as const;

export type MuscleFamily = keyof typeof MUSCLE_FAMILY_COLORS;

export interface MuscleStyle {
  /** Двобуквений код на плитці. */
  code: string;
  family: MuscleFamily;
  color: string;
}

const style = (code: string, family: MuscleFamily): MuscleStyle => ({
  code,
  family,
  color: MUSCLE_FAMILY_COLORS[family],
});

/**
 * Усі значення enum muscle_group. Record<MuscleGroup, …> — якщо в базі
 * з'явиться нова група, тут буде помилка типів.
 */
export const MUSCLE_STYLES: Record<MuscleGroup, MuscleStyle> = {
  chest: style("CH", "chest"),
  back: style("BK", "back"),
  shoulders: style("SH", "shoulders"),
  biceps: style("BI", "arms"),
  triceps: style("TR", "arms"),
  quads: style("QD", "legs"),
  hamstrings: style("HM", "legs"),
  glutes: style("GL", "legs"),
  calves: style("CV", "legs"),
  core: style("CO", "core"),
};

/** Група поза enum — сіра плитка з першими літерами назви. */
export const muscleStyle = (group: string): MuscleStyle =>
  MUSCLE_STYLES[group as MuscleGroup] ?? style(group.slice(0, 2).toUpperCase() || "··", "other");

// ───────────── Мініатюри вправ ─────────────

/** Картинка без групи / невідомої групи. */
export const DEFAULT_MUSCLE_IMAGE = "/muscles/default.webp";

/**
 * Мініатюра для кожної групи enum muscle_group (public/muscles/*.webp, 256×256).
 * Record<MuscleGroup, …> — нова група в базі дасть помилку типів.
 */
export const MUSCLE_IMAGES: Record<MuscleGroup, string> = {
  chest: "/muscles/chest.webp",
  back: "/muscles/back.webp",
  shoulders: "/muscles/shoulders.webp",
  biceps: "/muscles/biceps.webp",
  triceps: "/muscles/triceps.webp",
  quads: "/muscles/quads.webp",
  hamstrings: "/muscles/hamstrings.webp",
  glutes: "/muscles/glutes.webp",
  calves: "/muscles/calves.webp",
  core: "/muscles/core.webp",
};

/** Шлях до картинки групи; невідоме значення → default.webp. */
export const muscleImage = (group: string | null | undefined): string =>
  (group && MUSCLE_IMAGES[group as MuscleGroup]) || DEFAULT_MUSCLE_IMAGE;
