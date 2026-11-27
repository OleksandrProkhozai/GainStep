import { describe, expect, it } from "vitest";

import { suggestNextWeight, type Session } from "../progression";
import { explainSuggestion, type ExplainInput } from "../progression-explain";
import { fromDisplayWeight } from "../units";

const DATE = "2026-11-19T10:00:00.000Z";
const session = (weight: number, reps: number[], startedAt?: string): Session => ({
  sets: reps.map((r) => ({ weight, reps: r, isCompleted: true })),
  startedAt,
});
const input = (history: Session[], extra: Partial<ExplainInput> = {}): ExplainInput => ({
  history,
  repMin: 8,
  repMax: 12,
  targetSets: 3,
  increment: 2.5,
  equipment: "barbell",
  ...extra,
});
/** Пояснення саме тієї рекомендації, яку дав алгоритм. */
const explain = (i: ExplainInput, locale = "uk") => explainSuggestion(i, suggestNextWeight(i), locale);

describe("explainSuggestion", () => {
  it("increase: усі підходи на верхній межі → +2,5 кг", () => {
    expect(explain(input([session(60, [12, 12, 12], DATE)]))).toBe(
      "Минулого разу (19 лист.): 60 кг × 12, 12, 12. Ціль 3 × 8–12 — усі підходи на верхній межі → +2,5 кг.",
    );
    expect(explain(input([session(60, [12, 12, 12], DATE)]), "en")).toBe(
      "Last time (19 Nov): 60 kg × 12, 12, 12. Target 3 × 8–12 — all sets at the top of the range → +2.5 kg.",
    );
  });

  it("same: не всі підходи на верхній межі", () => {
    expect(explain(input([session(60, [12, 11, 10], DATE)]))).toBe(
      "Минулого разу (19 лист.): 60 кг × 12, 11, 10. Ціль 3 × 8–12 — ще не всі підходи на 12 повторень → та сама вага, 60 кг.",
    );
  });

  it("same: усі на верхній межі, але менше підходів, ніж у цілі", () => {
    expect(explain(input([session(60, [12, 12], DATE)]))).toBe(
      "Минулого разу (19 лист.): 60 кг × 12, 12. Ціль 3 × 8–12 — виконано 2 з 3 підходів → та сама вага, 60 кг.",
    );
  });

  it("одне невдале тренування → та сама вага з попередженням", () => {
    expect(explain(input([session(60, [7, 6, 6], DATE), session(60, [10, 9, 8])]))).toBe(
      "Минулого разу (19 лист.): 60 кг × 7, 6, 6. 2 підходи по 6 при мінімумі 8 → та сама вага, 60 кг. Якщо повториться наступного разу, буде розвантаження.",
    );
    expect(explain(input([session(60, [7, 6, 6], DATE), session(60, [10, 9, 8])]), "en")).toBe(
      "Last time (19 Nov): 60 kg × 7, 6, 6. 2 sets of 6 with a minimum of 8 → same weight, 60 kg. If it happens again next time, it's a deload.",
    );
  });

  it("невдале з різними повтореннями: '2 підходи по 5–6'", () => {
    expect(explain(input([session(60, [5, 6, 9], DATE)]))).toContain("2 підходи по 5–6 при мінімумі 8");
  });

  it("недобір 1 повторення → тримаємо вагу, без попередження про розвантаження", () => {
    const text = explain(input([session(60, [8, 8, 7], DATE)]));
    expect(text).toBe(
      "Минулого разу (19 лист.): 60 кг × 8, 8, 7. Недобір 1 повторення до мінімуму 8 — тримаємо вагу, 60 кг, наступного разу спробуйте добрати.",
    );
    expect(explain(input([session(60, [8, 8, 7], DATE)]), "en")).toBe(
      "Last time (19 Nov): 60 kg × 8, 8, 7. 1 rep short of the minimum 8 — keeping 60 kg, try to make it up next time.",
    );
  });

  it("сильний недобір лише в одному підході → та сама вага, без попередження", () => {
    const text = explain(input([session(60, [6, 9, 9], DATE), session(60, [6, 9, 10])]));
    expect(text).toBe(
      "Минулого разу (19 лист.): 60 кг × 6, 9, 9. Сильний недобір лише в одному підході (6 при мінімумі 8) → та сама вага, 60 кг.",
    );
    expect(explain(input([session(60, [6, 9, 9], DATE)]), "en")).toBe(
      "Last time (19 Nov): 60 kg × 6, 9, 9. Big shortfall on only one set (6 with a minimum of 8) → same weight, 60 kg.",
    );
  });

  it("1 цільовий підхід: '1 підхід по 6'", () => {
    expect(explain(input([session(60, [6], DATE)], { targetSets: 1 }))).toContain(
      "1 підхід по 6 при мінімумі 8 → та сама вага, 60 кг. Якщо повториться наступного разу, буде розвантаження.",
    );
  });

  it("deload: другий раз поспіль сильний недобір → −10% → 55 кг", () => {
    expect(explain(input([session(60, [6, 6, 8], DATE), session(60, [7, 6, 6])]))).toBe(
      "Минулого разу (19 лист.): 60 кг × 6, 6, 8. Другий раз поспіль сильний недобір → розвантаження −10% → 55 кг.",
    );
    expect(explain(input([session(60, [6, 6, 8], DATE), session(60, [7, 6, 6])]), "en")).toBe(
      "Last time (19 Nov): 60 kg × 6, 6, 8. Big rep shortfall for the second session in a row → deload −10% → 55 kg.",
    );
  });

  it("none: немає історії", () => {
    expect(explain(input([]))).toBe("Ще немає історії — оберіть стартову вагу.");
    expect(explain(input([]), "en")).toBe("No history yet — pick a starting weight.");
  });

  it("без дати (старий збережений стан) — без дужок", () => {
    expect(explain(input([session(60, [12, 12, 12])]))).toMatch(/^Минулого разу: 60 кг × 12, 12, 12\./);
  });

  it("тренажер: вага не на сітці кроку → кратне кроку", () => {
    const i = input([session(42.5, [10, 10, 9], DATE)], { increment: 5, equipment: "cable" });
    expect(explain(i)).toBe(
      "Минулого разу (19 лист.): 42,5 кг × 10, 10, 9. Ціль 3 × 8–12 — ще не всі підходи на 12 повторень → 40 кг (кратно кроку тренажера).",
    );
  });

  it("власна вага: без рекомендації ваги", () => {
    const i = input([session(0, [15, 15, 15], DATE)], { equipment: "bodyweight", repMax: 15 });
    expect(explain(i)).toBe("Вправа з власною вагою: вагу не додаємо — збільшуйте повторення до 15 у всіх підходах.");
    // І без історії — не "оберіть стартову вагу".
    expect(explain(input([], { equipment: "bodyweight", repMax: 15 }))).toMatch(/^Вправа з власною вагою/);
  });

  it("lb: вага й крок в lb", () => {
    const i = input([session(fromDisplayWeight(135, "lb"), [12, 12, 12], DATE)], {
      unit: "lb",
      increment: fromDisplayWeight(5, "lb"),
    });
    expect(explain(i, "en")).toBe(
      "Last time (19 Nov): 135 lb × 12, 12, 12. Target 3 × 8–12 — all sets at the top of the range → +5 lb.",
    );
  });

  it("діапазон з однаковими межами: '3 × 10'", () => {
    expect(explain(input([session(60, [10, 10, 10], DATE)], { repMin: 10, repMax: 10 }))).toContain("Ціль 3 × 10 —");
  });
});
