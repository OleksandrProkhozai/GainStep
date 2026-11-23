import { z } from "@/lib/validations/zod-codes";
import { TRANSITION_REST } from "@/lib/workout/rest";

/**
 * Обмеження програми. Числа — як у CHECK-обмеженнях бази
 * (rest_seconds у базі до 900, редактор — до 600). Назва програми в базі
 * має 2–80 символів, тож мінімум тут 2, а не 1.
 */
export const PROGRAM_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  daysMin: 1,
  daysMax: 7,
  dayNameMin: 1,
  dayNameMax: 30,
  setsMin: 1,
  setsMax: 10,
  repsMin: 1,
  repsMax: 100,
  restMin: 0,
  restMax: 600,
  restStep: 15,
} as const;

const L = PROGRAM_LIMITS;

export const programNameSchema = z
  .string()
  .trim()
  .min(L.nameMin, "programNameMin")
  .max(L.nameMax, "programNameMax");

export const dayNameSchema = z
  .string()
  .trim()
  .min(L.dayNameMin, "dayNameRequired")
  .max(L.dayNameMax, "dayNameMax");

/** Ціле в межах; помилка — один код на поле (setsRange, repsRange, restRange). */
const int = (min: number, max: number, code: string) => z.number().int(code).min(min, code).max(max, code);

export const programExerciseSchema = z
  .object({
    id: z.guid().nullable(),
    exercise_id: z.guid(),
    target_sets: int(L.setsMin, L.setsMax, "setsRange"),
    rep_min: int(L.repsMin, L.repsMax, "repsRange"),
    rep_max: int(L.repsMin, L.repsMax, "repsRange"),
    rest_seconds: int(L.restMin, L.restMax, "restRange"),
    /** null — авто (5:00 після базової, 3:00 після ізолюючої). */
    transition_rest_seconds: int(TRANSITION_REST.min, TRANSITION_REST.max, "transitionRestRange").nullable(),
  })
  .refine((e) => e.rep_min <= e.rep_max, {
    message: "repsOrder",
    path: ["rep_min"],
  });

export const programDaySchema = z
  .object({
    id: z.guid().nullable(),
    name: dayNameSchema,
    exercises: z.array(programExerciseSchema),
  })
  .superRefine((day, ctx) => {
    if (day.exercises.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "dayNeedsExercise",
        path: ["exercises"],
      });
    }
    const seen = new Set<string>();
    day.exercises.forEach((e, i) => {
      if (seen.has(e.exercise_id)) {
        ctx.addIssue({
          code: "custom",
          message: "dayDuplicateExercise",
          path: ["exercises", i, "exercise_id"],
        });
      }
      seen.add(e.exercise_id);
    });
  });

/** Payload RPC save_program — валідується і на клієнті, і на сервері. */
export const saveProgramSchema = z.object({
  name: programNameSchema,
  days: z
    .array(programDaySchema)
    .min(L.daysMin, "programNeedsDay")
    .max(L.daysMax, "programMaxDays"),
});

export type SaveProgramPayload = z.infer<typeof saveProgramSchema>;
export type SaveProgramExercise = z.infer<typeof programExerciseSchema>;

/** Код першої помилки валідації (errors.*) — для toast. */
export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "invalidForm";
}

/** Індекс дня, до якого належить перша помилка (щоб показати його назву й вкладку). */
export function issueDayIndex(error: z.ZodError): number | null {
  const path = error.issues[0]?.path ?? [];
  return path[0] === "days" && typeof path[1] === "number" ? path[1] : null;
}
