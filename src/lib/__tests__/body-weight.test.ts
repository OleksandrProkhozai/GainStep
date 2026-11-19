import { describe, expect, it } from "vitest";

import {
  bodyWeightToKg,
  historyRows,
  isDayKey,
  parseBodyWeightInput,
  summarizeBodyWeight,
  toBodyUnit,
  validateBodyWeight,
  weightDomain,
} from "../progress/body-weight";

describe("parseBodyWeightInput", () => {
  it("приймає крапку і кому, один знак після коми", () => {
    expect(parseBodyWeightInput("73.4", "kg")).toEqual({ ok: true, value: 73.4 });
    expect(parseBodyWeightInput(" 73,4 ", "kg")).toEqual({ ok: true, value: 73.4 });
    expect(parseBodyWeightInput("73", "kg")).toEqual({ ok: true, value: 73 });
  });

  it("відхиляє більше одного знаку після коми", () => {
    expect(parseBodyWeightInput("73.45", "kg")).toMatchObject({ ok: false, error: "weightOneDecimal" });
  });

  it("відхиляє порожнє поле і не числа", () => {
    expect(parseBodyWeightInput("", "kg").ok).toBe(false);
    expect(parseBodyWeightInput("abc", "kg").ok).toBe(false);
    expect(parseBodyWeightInput("-70", "kg").ok).toBe(false);
  });

  it("межі: 30–300 kg, 66–660 lb", () => {
    expect(parseBodyWeightInput("30", "kg").ok).toBe(true);
    expect(parseBodyWeightInput("300", "kg").ok).toBe(true);
    expect(parseBodyWeightInput("29.9", "kg")).toMatchObject({ ok: false, error: "weightRange" });
    expect(parseBodyWeightInput("300.1", "kg").ok).toBe(false);
    expect(parseBodyWeightInput("66", "lb").ok).toBe(true);
    expect(parseBodyWeightInput("660", "lb").ok).toBe(true);
    expect(parseBodyWeightInput("65.9", "lb").ok).toBe(false);
    expect(parseBodyWeightInput("661", "lb").ok).toBe(false);
  });
});

describe("validateBodyWeight", () => {
  it("перевіряє число з сервера так само, як поле", () => {
    expect(validateBodyWeight(73.4, "kg")).toEqual({ ok: true, value: 73.4 });
    expect(validateBodyWeight(73.45, "kg").ok).toBe(false);
    expect(validateBodyWeight(Number.NaN, "kg").ok).toBe(false);
  });
});

describe("перетворення одиниць", () => {
  it("lb → kg → lb повертає те саме значення до 0.1", () => {
    for (const lb of [66, 150.5, 160.3, 220, 660]) {
      expect(toBodyUnit(bodyWeightToKg(lb, "lb"), "lb")).toBe(lb);
    }
  });

  it("kg зберігається як є", () => {
    expect(bodyWeightToKg(73.4, "kg")).toBe(73.4);
    expect(toBodyUnit(73.4, "kg")).toBe(73.4);
  });
});

describe("isDayKey", () => {
  it("лише справжні дати", () => {
    expect(isDayKey("2026-11-17")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-1-7")).toBe(false);
    expect(isDayKey("yesterday")).toBe(false);
  });
});

describe("summarizeBodyWeight", () => {
  const entries = [
    { date: "2026-08-01", weightKg: 72 },
    { date: "2026-11-03", weightKg: 74.6 },
    { date: "2026-11-10", weightKg: 75 },
    { date: "2026-11-17", weightKg: 75.4 },
  ];

  it("зміна від першого запису періоду", () => {
    const s = summarizeBodyWeight(entries, "2026-10-17", "kg");
    expect(s.inPeriod).toHaveLength(3);
    expect(s.delta).toBe(0.8);
    expect(s.since).toBe("2026-11-03");
    expect(s.latest?.weightKg).toBe(75.4);
  });

  it("уся історія", () => {
    expect(summarizeBodyWeight(entries, null, "kg").delta).toBe(3.4);
  });

  it("менше 2 записів у періоді — без зміни, але з поточною вагою", () => {
    const s = summarizeBodyWeight(entries, "2026-11-15", "kg");
    expect(s).toMatchObject({ delta: null, since: null });
    expect(s.latest?.date).toBe("2026-11-17");
  });

  it("зміна в lb", () => {
    expect(summarizeBodyWeight(entries, "2026-10-17", "lb").delta).toBe(1.7); // 166.2 − 164.5 (74.6 kg → 164.5 lb, 75.4 kg → 166.2 lb)
  });

  it("порожня історія", () => {
    expect(summarizeBodyWeight([], null, "kg")).toEqual({ latest: null, inPeriod: [], delta: null, since: null });
  });
});

describe("weightDomain", () => {
  it("[min − 1, max + 1], округлено до цілих", () => {
    expect(weightDomain([71.6, 73.4])).toEqual([70, 75]);
    expect(weightDomain([72, 72])).toEqual([71, 73]);
  });
});

describe("historyRows", () => {
  it("від нових до старих із різницею з попереднім записом", () => {
    const rows = historyRows(
      [
        { date: "2026-11-01", weightKg: 73 },
        { date: "2026-11-03", weightKg: 73.4 },
        { date: "2026-11-05", weightKg: 73.4 },
      ],
      "kg",
    );
    expect(rows.map((r) => [r.date, r.diff])).toEqual([
      ["2026-11-05", 0],
      ["2026-11-03", 0.4],
      ["2026-11-01", null],
    ]);
  });
});
