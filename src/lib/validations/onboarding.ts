import { z } from "@/lib/validations/zod-codes";
import { fromDisplayWeight } from "@/lib/units";
import type { Enums } from "@/types/database.types";

export const WEIGHT_LIMITS = {
  kg: { min: 30, max: 300 },
  lb: { min: 66, max: 660 },
} as const satisfies Record<Enums<"weight_unit">, { min: number; max: number }>;


const unit = z.enum(["kg", "lb"]);

/** Рядок із поля вводу: ціле число або один знак після коми/крапки. */
const weight = z
  .string()
  .trim()
  .min(1, { error: "weightRequired" })
  .regex(/^\d{1,3}([.,]\d)?$/, {
    error: "weightOneDecimal",
  })
  .transform((value) => Number(value.replace(",", ".")));

/** Перевірка діапазону залежно від одиниць (30–300 kg / 66–660 lb). */
function refineWeightRange(
  data: { weight: number; unit: Enums<"weight_unit"> },
  ctx: z.RefinementCtx,
) {
  const { min, max } = WEIGHT_LIMITS[data.unit];
  if (data.weight < min || data.weight > max) {
    ctx.addIssue({
      code: "custom",
      path: ["weight"],
      // Межі клієнт бере з WEIGHT_LIMITS[unit] (errors.weightRange).
      message: "weightRange",
    });
  }
}

/** Крок 1: вага тіла + одиниці. */
export const bodyWeightStepSchema = z
  .object({ weight, unit })
  .superRefine(refineWeightRange);

/** Усі дані онбордингу, що надсилаються в server action. */
export const onboardingSchema = z
  .object({
    weight,
    unit,
    experience: z.enum(["beginner", "intermediate"]),
    goal: z.enum(["strength", "hypertrophy"]),
    // z.guid(), а не z.uuid(): id шаблонів у seed не відповідають RFC-версії.
    templateId: z.guid().nullable(),
    // Локальна дата користувача (YYYY-MM-DD) для запису ваги «на сьогодні».
    today: z.iso.date(),
  })
  .superRefine(refineWeightRange);

export type OnboardingInput = z.input<typeof onboardingSchema>;

/** Перевести вагу в кг і округлити до 0.01. */
export function toKg(value: number, unitValue: Enums<"weight_unit">) {
  const kg = fromDisplayWeight(value, unitValue);
  return Math.round(kg * 100) / 100;
}
