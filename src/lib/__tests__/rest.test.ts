import { describe, expect, it } from "vitest";

import { autoTransitionRest, effectiveRest, isRaisedByMin, stepTransitionRest, transitionRest } from "../workout/rest";

describe("effectiveRest — max(відпочинок вправи, мінімум з налаштувань)", () => {
  it("відпочинок вправи менший за мінімум → мінімум", () => {
    expect(effectiveRest(60, 120)).toBe(120);
    expect(isRaisedByMin(60, 120)).toBe(true);
  });

  it("відпочинок вправи більший за мінімум → без змін", () => {
    expect(effectiveRest(180, 120)).toBe(180);
    expect(isRaisedByMin(180, 120)).toBe(false);
  });

  it("рівні → те саме значення, замок не показується", () => {
    expect(effectiveRest(90, 90)).toBe(90);
    expect(isRaisedByMin(90, 90)).toBe(false);
  });

  it("мінімум 0 — вимкнено", () => {
    expect(effectiveRest(0, 0)).toBe(0);
    expect(effectiveRest(45, 0)).toBe(45);
    expect(isRaisedByMin(45, 0)).toBe(false);
  });
});

describe("transitionRest — відпочинок між вправами", () => {
  const on = { minRestSeconds: 0, transitionRestEnabled: true };

  it("базова вправа → 5:00, ізолююча → 3:00", () => {
    expect(transitionRest({ isCompound: true }, on)).toBe(300);
    expect(transitionRest({ isCompound: false }, on)).toBe(180);
    // старий збережений стан без поля — як ізолююча
    expect(transitionRest({}, on)).toBe(180);
    expect(autoTransitionRest({ isCompound: true })).toBe(300);
  });

  it("власне значення вправи має пріоритет над авто (і 0 — теж власне)", () => {
    expect(transitionRest({ isCompound: true, transitionRestSeconds: 240 }, on)).toBe(240);
    expect(transitionRest({ isCompound: false, transitionRestSeconds: 420 }, on)).toBe(420);
    expect(transitionRest({ isCompound: true, transitionRestSeconds: 0 }, on)).toBe(0);
    expect(transitionRest({ isCompound: true, transitionRestSeconds: null }, on)).toBe(300);
  });

  it("мінімальний відпочинок більший — береться мінімум", () => {
    expect(transitionRest({ isCompound: false }, { ...on, minRestSeconds: 240 })).toBe(240);
    expect(transitionRest({ transitionRestSeconds: 60 }, { ...on, minRestSeconds: 120 })).toBe(120);
    expect(transitionRest({ isCompound: true }, { ...on, minRestSeconds: 120 })).toBe(300);
  });

  it("остання вправа тренування → null", () => {
    expect(transitionRest({ isCompound: true }, on, false)).toBeNull();
  });

  it("вимкнено в налаштуваннях → null", () => {
    expect(transitionRest({ isCompound: true, transitionRestSeconds: 400 }, { ...on, transitionRestEnabled: false })).toBeNull();
  });

  it("крок степера ±30 с у межах 0:00–15:00", () => {
    expect(stepTransitionRest(300, 1)).toBe(330);
    expect(stepTransitionRest(300, -1)).toBe(270);
    expect(stepTransitionRest(0, -1)).toBe(0);
    expect(stepTransitionRest(900, 1)).toBe(900);
    expect(stepTransitionRest(185, 1)).toBe(210); // спершу до кроку 30
  });
});
