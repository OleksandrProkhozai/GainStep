import { describe, expect, it } from "vitest";

import { effectiveRest, isRaisedByMin } from "../workout/rest";

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
