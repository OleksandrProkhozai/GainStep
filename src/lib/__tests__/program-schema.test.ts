import { describe, expect, it } from "vitest";

import { saveProgramSchema, type SaveProgramPayload } from "../programs/schema";

const EX_A = "11111111-1111-4111-8111-111111111111";
const EX_B = "22222222-2222-4222-8222-222222222222";
const DAY_ID = "33333333-3333-4333-8333-333333333333";

const exercise = (exercise_id = EX_A, overrides: Partial<SaveProgramPayload["days"][number]["exercises"][number]> = {}) => ({
  id: null,
  exercise_id,
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  rest_seconds: 90,
  transition_rest_seconds: null,
  ...overrides,
});

const day = (name = "Push", exercises = [exercise()]) => ({ id: null, name, exercises });

const valid = (): SaveProgramPayload => ({
  name: "Push Pull Legs",
  days: [{ ...day(), id: DAY_ID }, day("Pull", [exercise(EX_A), exercise(EX_B)])],
});

const issues = (payload: unknown) => {
  const r = saveProgramSchema.safeParse(payload);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("saveProgramSchema — валідні програми", () => {
  it("звичайна програма проходить; назви обрізаються від пробілів", () => {
    const r = saveProgramSchema.safeParse({ ...valid(), name: "  PPL  " });
    expect(r.success).toBe(true);
    expect(r.success && r.data.name).toBe("PPL");
  });

  it("межі: 7 днів, 10 підходів, 1–100 повторень, відпочинок 0 і 600 с, min = max", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(`Day ${i + 1}`, [exercise(EX_A, { target_sets: 10, rep_min: 1, rep_max: 100, rest_seconds: i % 2 ? 0 : 600 })]),
    );
    expect(issues({ name: "Full", days })).toEqual([]);
    expect(issues({ name: "Full", days: [day("A", [exercise(EX_A, { rep_min: 5, rep_max: 5 })])] })).toEqual([]);
  });
});

describe("saveProgramSchema — невалідні програми", () => {
  it("min > max повторень", () => {
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A, { rep_min: 12, rep_max: 8 })])] })).toContain(
      "repsOrder",
    );
  });

  it("порожній день", () => {
    expect(issues({ name: "P1", days: [day("Legs", [])] })).toContain("dayNeedsExercise");
  });

  it("дублікат вправи в межах дня (в різних днях — можна)", () => {
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A), exercise(EX_A)])] })).toContain(
      "dayDuplicateExercise",
    );
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A)]), day("B", [exercise(EX_A)])] })).toEqual([]);
  });

  it("8 днів і 0 днів", () => {
    const eight = Array.from({ length: 8 }, (_, i) => day(`D${i}`));
    expect(issues({ name: "P1", days: eight })).toContain("programMaxDays");
    expect(issues({ name: "P1", days: [] })).toContain("programNeedsDay");
  });

  it("назви: програма 2–60, день 1–30", () => {
    expect(issues({ ...valid(), name: "A" }).length).toBeGreaterThan(0);
    expect(issues({ ...valid(), name: "x".repeat(61) }).length).toBeGreaterThan(0);
    expect(issues({ name: "P1", days: [day("   ")] })).toContain("dayNameRequired");
    expect(issues({ name: "P1", days: [day("x".repeat(31))] }).length).toBeGreaterThan(0);
  });

  it("числа поза межами бази", () => {
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A, { target_sets: 11 })])] }).length).toBe(1);
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A, { target_sets: 0 })])] }).length).toBe(1);
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A, { rest_seconds: 601 })])] }).length).toBe(1);
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A, { rep_max: 101 })])] }).length).toBe(1);
    expect(issues({ name: "P1", days: [day("A", [exercise(EX_A, { target_sets: 2.5 })])] }).length).toBe(1);
  });

  it("некоректні id", () => {
    expect(issues({ name: "P1", days: [day("A", [exercise("not-a-uuid")])] }).length).toBeGreaterThan(0);
  });
});
