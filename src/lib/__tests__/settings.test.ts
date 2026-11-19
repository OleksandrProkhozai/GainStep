import { describe, expect, it } from "vitest";

import { getInitials } from "../profile/initials";
import { formatRest, profilePatchSchema, REST_LIMITS, stepRest, toProfileColumns } from "../profile/schema";
import { fromDisplayWeight, inputToKg, toInputWeight, weightStep } from "../units";

describe("profilePatchSchema (updateProfile)", () => {
  it("приймає часткове оновлення й обрізає ім'я", () => {
    expect(profilePatchSchema.parse({ displayName: "  Oleksandr  " })).toEqual({ displayName: "Oleksandr" });
    expect(profilePatchSchema.parse({ unit: "lb" })).toEqual({ unit: "lb" });
    expect(profilePatchSchema.parse({ experience: "intermediate", goal: "hypertrophy" })).toEqual({
      experience: "intermediate",
      goal: "hypertrophy",
    });
  });

  it("ім'я 1–60 символів після trim", () => {
    expect(profilePatchSchema.safeParse({ displayName: "   " }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ displayName: "A" }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ displayName: "a".repeat(60) }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ displayName: "a".repeat(61) }).success).toBe(false);
  });

  it("значення enum-ів і unit", () => {
    expect(profilePatchSchema.safeParse({ experience: "advanced" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ goal: "fitness" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ unit: "stone" }).success).toBe(false);
  });

  it("мінімальний відпочинок: ціле, 0–300, кратне 15", () => {
    for (const ok of [0, 15, 90, 300]) expect(profilePatchSchema.safeParse({ minRestSeconds: ok }).success).toBe(true);
    for (const bad of [-15, 315, 600, 100, 90.5]) expect(profilePatchSchema.safeParse({ minRestSeconds: bad }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ minRestSeconds: 315 }).error?.issues[0]?.message).toBe("minRestRange");
  });

  it("порожній patch і зайві ключі відхиляються", () => {
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
    expect(profilePatchSchema.safeParse({ unit: "kg", id: "x" }).success).toBe(false);
  });

  it("toProfileColumns пише лише передані поля", () => {
    expect(toProfileColumns({ minRestSeconds: 120 })).toEqual({ min_rest_seconds: 120 });
    expect(toProfileColumns({ displayName: "Olek", unit: "lb" })).toEqual({ display_name: "Olek", unit: "lb" });
  });
});

describe("степер мінімального відпочинку", () => {
  it("крок 15 с у межах 0:00–5:00", () => {
    expect(stepRest(90, 1)).toBe(105);
    expect(stepRest(90, -1)).toBe(75);
    expect(stepRest(REST_LIMITS.min, -1)).toBe(0);
    expect(stepRest(REST_LIMITS.max, 1)).toBe(300);
    expect(stepRest(100, 1)).toBe(120); // 100 → вирівнюється до 105, далі +15
  });

  it("формат m:ss", () => {
    expect(formatRest(0)).toBe("0:00");
    expect(formatRest(90)).toBe("1:30");
    expect(formatRest(600)).toBe("10:00");
    expect(formatRest(15)).toBe("0:15");
  });
});

describe("getInitials", () => {
  it("з імені", () => {
    expect(getInitials("Oleksandr Prokhozai")).toBe("OP");
    expect(getInitials("oleksandr")).toBe("O");
    expect(getInitials("  Олександр   Прохожай ")).toBe("ОП");
  });

  it("порожнє ім'я — з email", () => {
    expect(getInitials(null, "oleksandr.prokhozai@gmail.com")).toBe("OP");
    expect(getInitials("   ", "alex@x.com")).toBe("A");
    expect(getInitials("", null)).toBe("?");
  });
});

describe("unit у формах: kg → lb → kg без дрейфу", () => {
  it("62.5 kg показується як 138 lb і без змін лишається 62.5 kg", () => {
    const shown = toInputWeight(62.5, "lb");
    expect(shown).toBe(138);
    expect(inputToKg(shown, "lb", 62.5)).toBe(62.5);
    // без початкового значення — чесний перерахунок
    expect(inputToKg(shown, "lb")).toBeCloseTo(62.596, 3);
  });

  it("крок ваги 2.5 kg у lb (5.5) не перетворюється на 2.49 kg", () => {
    expect(toInputWeight(2.5, "lb")).toBe(5.5);
    expect(inputToKg(5.5, "lb", 2.5)).toBe(2.5);
  });

  it("змінене значення конвертується один раз", () => {
    expect(inputToKg(140, "lb", 62.5)).toBeCloseTo(fromDisplayWeight(140, "lb"), 10);
    expect(inputToKg(65, "kg", 62.5)).toBe(65);
  });

  it("lb-степер використовує крок з units.ts", () => {
    expect(weightStep(2.5, "lb")).toBe(5);
    expect(weightStep(1, "lb")).toBe(2.5);
    expect(weightStep(2.5, "kg")).toBe(2.5);
  });

  it("135 lb → кг → знову 135 lb", () => {
    const kg = fromDisplayWeight(135, "lb");
    expect(toInputWeight(kg, "lb")).toBe(135);
  });
});
