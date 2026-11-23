import { describe, expect, it } from "vitest";

import { DEFAULT_STEP_KG, EQUIPMENT, exerciseFormSchema, minStepKg } from "../exercises/catalog";

const base = { name: "Cable Fly", muscleGroup: "chest" as const, unit: "kg" as const };

describe("крок ваги власної вправи", () => {
  it("за замовчуванням — за обладнанням", () => {
    expect(DEFAULT_STEP_KG).toEqual({
      barbell: 2.5,
      dumbbell: 2,
      machine: 5,
      cable: 5,
      bodyweight: 2.5,
      kettlebell: 4,
    });
    for (const eq of EQUIPMENT) expect(DEFAULT_STEP_KG[eq]).toBeGreaterThanOrEqual(minStepKg(eq));
  });

  it("тренажер і блок — не менше 5 кг", () => {
    for (const equipment of ["machine", "cable"] as const) {
      expect(exerciseFormSchema.safeParse({ ...base, equipment, weightStep: 2.5 }).error?.issues[0]?.message).toBe(
        "weightStepMachineMin",
      );
      expect(exerciseFormSchema.safeParse({ ...base, equipment, weightStep: 5 }).success).toBe(true);
      expect(exerciseFormSchema.safeParse({ ...base, equipment, weightStep: 10 }).success).toBe(true);
    }
  });

  it("у lb: 10 lb (4.5 кг) — замало, 11.5 lb — достатньо", () => {
    const cable = { ...base, equipment: "cable" as const, unit: "lb" as const };
    expect(exerciseFormSchema.safeParse({ ...cable, weightStep: 10 }).success).toBe(false);
    expect(exerciseFormSchema.safeParse({ ...cable, weightStep: 11.5 }).success).toBe(true);
  });

  it("інше обладнання — дрібний крок дозволено", () => {
    expect(exerciseFormSchema.safeParse({ ...base, equipment: "dumbbell", weightStep: 1 }).success).toBe(true);
    expect(exerciseFormSchema.safeParse({ ...base, equipment: "barbell", weightStep: 1.25 }).success).toBe(true);
  });
});
