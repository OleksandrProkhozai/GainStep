import { describe, expect, it } from "vitest";

import {
  cleanFloat,
  epley1RM,
  roundToIncrement,
  sessionVolume,
  setVolume,
} from "../metrics";

describe("epley1RM", () => {
  it("0 повторень → 0", () => {
    expect(epley1RM(100, 0)).toBe(0);
  });

  it("нульова або від'ємна вага → 0", () => {
    expect(epley1RM(0, 10)).toBe(0);
    expect(epley1RM(-5, 10)).toBe(0);
  });

  it("1 повторення → сама вага", () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it("60 кг × 12 → рівно 84 кг", () => {
    expect(epley1RM(60, 12)).toBe(84);
  });

  it("62.5 кг × 12 → 87.5 кг", () => {
    expect(epley1RM(62.5, 12)).toBe(87.5);
  });
});

describe("setVolume / sessionVolume", () => {
  it("тоннаж підходу = вага × повторення", () => {
    expect(setVolume(60, 12)).toBe(720);
    expect(setVolume(62.5, 10)).toBe(625);
  });

  it("від'ємні значення вважаються нулем", () => {
    expect(setVolume(-60, 12)).toBe(0);
    expect(setVolume(60, -1)).toBe(0);
  });

  it("сума лише по виконаних підходах", () => {
    expect(
      sessionVolume([
        { weight: 60, reps: 12, isCompleted: true },
        { weight: 60, reps: 12, isCompleted: true },
        { weight: 60, reps: 12, isCompleted: false },
      ]),
    ).toBe(1440);
  });

  it("порожнє тренування → 0", () => {
    expect(sessionVolume([])).toBe(0);
  });

  it("без похибок float при дробових вагах", () => {
    expect(
      sessionVolume([
        { weight: 0.1, reps: 1, isCompleted: true },
        { weight: 0.2, reps: 1, isCompleted: true },
      ]),
    ).toBe(0.3);
  });
});

describe("roundToIncrement", () => {
  it("крок 2.5: рівно посередині — вгору (56.25 → 57.5)", () => {
    expect(roundToIncrement(56.25, 2.5)).toBe(57.5);
  });

  it("крок 2.5: нижче середини — вниз (56.2 → 55)", () => {
    expect(roundToIncrement(56.2, 2.5)).toBe(55);
  });

  it("крок 1", () => {
    expect(roundToIncrement(56.4, 1)).toBe(56);
    expect(roundToIncrement(56.5, 1)).toBe(57);
  });

  it("крок 5", () => {
    expect(roundToIncrement(92, 5)).toBe(90);
    expect(roundToIncrement(93, 5)).toBe(95);
  });

  it("без похибок float (результат рівно 62.5)", () => {
    expect(roundToIncrement(62.49999999999999, 2.5)).toBe(62.5);
    expect(roundToIncrement(0.9 * 62.5, 2.5)).toBe(57.5);
  });

  it("дробовий крок 0.1: 0.35 → 0.4, 0.1 + 0.2 → 0.3", () => {
    expect(roundToIncrement(0.35, 0.1)).toBe(0.4);
    expect(roundToIncrement(0.1 + 0.2, 0.1)).toBe(0.3);
  });

  it("некоректний крок — вага без змін", () => {
    expect(roundToIncrement(56.3, 0)).toBe(56.3);
    expect(roundToIncrement(56.3, -2.5)).toBe(56.3);
    expect(roundToIncrement(56.3, Number.NaN)).toBe(56.3);
  });
});

describe("cleanFloat", () => {
  it("прибирає хвости float і нормалізує −0", () => {
    expect(cleanFloat(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(cleanFloat(-0), 0)).toBe(true);
  });
});
