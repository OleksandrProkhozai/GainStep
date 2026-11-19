/**
 * Налаштування профілю: межі, підписи і zod-схема часткового оновлення
 * (updateProfile пише лише поля, що змінились).
 */

import { LOCALES, type Locale } from "@/i18n/config";
import { z } from "@/lib/validations/zod-codes";
import type { Enums } from "@/types/database.types";

export type Experience = Enums<"experience_level">;
export type Goal = Enums<"training_goal">;

/** Значення enum-ів у порядку з міграції; підписи — common.enums.* у messages. */
export const EXPERIENCES = ["beginner", "intermediate"] as const satisfies readonly Experience[];
export const GOALS = ["strength", "hypertrophy"] as const satisfies readonly Goal[];
export const UNITS = ["kg", "lb"] as const satisfies readonly Enums<"weight_unit">[];

export const NAME_LIMITS = { min: 1, max: 60 } as const;

/** Таймер відпочинку за замовчуванням: 0:00–10:00, крок 15 с. */
export const REST_LIMITS = { min: 0, max: 600, step: 15, fallback: 90 } as const;

export const displayNameSchema = z
  .string()
  .trim()
  .min(NAME_LIMITS.min, "nameRequired")
  .max(NAME_LIMITS.max, "nameMax");

export const restSecondsSchema = z
  .number()
  .int("restRange")
  .min(REST_LIMITS.min, "restRange")
  .max(REST_LIMITS.max, "restRange")
  .refine((v) => v % REST_LIMITS.step === 0, "restStep");

/** Часткове оновлення профілю: хоча б одне поле, зайві ключі заборонені. */
export const profilePatchSchema = z
  .strictObject({
    displayName: displayNameSchema,
    experience: z.enum(EXPERIENCES),
    goal: z.enum(GOALS),
    unit: z.enum(UNITS),
    defaultRestSeconds: restSecondsSchema,
    locale: z.enum(LOCALES),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "nothingToUpdate");

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** Patch → колонки profiles (лише присутні поля). */
export function toProfileColumns(patch: ProfilePatch) {
  const columns: {
    display_name?: string;
    experience?: Experience;
    goal?: Goal;
    unit?: Enums<"weight_unit">;
    default_rest_seconds?: number;
    locale?: Locale;
  } = {};
  if (patch.displayName !== undefined) columns.display_name = patch.displayName;
  if (patch.experience !== undefined) columns.experience = patch.experience;
  if (patch.goal !== undefined) columns.goal = patch.goal;
  if (patch.unit !== undefined) columns.unit = patch.unit;
  if (patch.defaultRestSeconds !== undefined) columns.default_rest_seconds = patch.defaultRestSeconds;
  if (patch.locale !== undefined) columns.locale = patch.locale;
  return columns;
}

/** Крок степера таймера: ±15 с у межах 0–600. */
export function stepRest(seconds: number, direction: 1 | -1) {
  const snapped = Math.round(seconds / REST_LIMITS.step) * REST_LIMITS.step;
  return Math.min(REST_LIMITS.max, Math.max(REST_LIMITS.min, snapped + direction * REST_LIMITS.step));
}

/** Формат m:ss — той самий, що в редакторі програм. */
export { formatRest } from "@/lib/programs/draft";
