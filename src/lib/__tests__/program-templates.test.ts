import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { pickNextDay } from "../dashboard/queries";
import { buildTemplateNames, LEGACY_TEMPLATE_NAMES, templateName } from "../programs/template-names";
import { recommendTemplateId, TEMPLATE_IDS, templateSchedule } from "../programs/templates";

describe("recommendTemplateId — шаблон за досвідом", () => {
  it("beginner → Full Body", () => {
    expect(recommendTemplateId("beginner")).toBe(TEMPLATE_IDS.fullBody);
  });

  it("intermediate → Upper / Lower", () => {
    expect(recommendTemplateId("intermediate")).toBe(TEMPLATE_IDS.upperLower);
  });

  it("advanced → Push Pull Legs", () => {
    expect(recommendTemplateId("advanced")).toBe(TEMPLATE_IDS.pushPullLegs);
  });

  it("досвід ще не вибрано або невідомий → без рекомендації", () => {
    expect(recommendTemplateId(null)).toBeNull();
    expect(recommendTemplateId(undefined)).toBeNull();
    expect(recommendTemplateId("pro")).toBeNull();
  });
});

describe("templateSchedule — підпис розкладу на картці шаблону", () => {
  it("Full Body: 3× на тиждень, 2 дні по черзі", () => {
    expect(templateSchedule(3, 2)).toEqual({ perWeek: "3", days: 2, alternating: true });
  });

  it("Upper / Lower: 4× на тиждень, 4 дні", () => {
    expect(templateSchedule(4, 4)).toEqual({ perWeek: "4", days: 4, alternating: false });
  });

  it("Push Pull Legs: 6× і 3 дні → 3–6× (одне або два кола)", () => {
    expect(templateSchedule(6, 3)).toEqual({ perWeek: "3–6", days: 3, alternating: false });
  });

  it("без днів — просто days_per_week", () => {
    expect(templateSchedule(3, 0)).toEqual({ perWeek: "3", days: 0, alternating: false });
  });
});

describe("pickNextDay — ротація днів шаблону по колу", () => {
  const upperLower = [{ id: "upper-a" }, { id: "lower-a" }, { id: "upper-b" }, { id: "lower-b" }];
  const done = (...ids: (string | null)[]) => ids.map((program_day_id) => ({ program_day_id }));

  it("без тренувань — перший день", () => {
    expect(pickNextDay(upperLower, [])?.id).toBe("upper-a");
  });

  it("4 дні Upper / Lower: A → Lower A → Upper B → Lower B → знову Upper A", () => {
    // Тренування — від найновішого.
    expect(pickNextDay(upperLower, done("upper-a"))?.id).toBe("lower-a");
    expect(pickNextDay(upperLower, done("lower-a", "upper-a"))?.id).toBe("upper-b");
    expect(pickNextDay(upperLower, done("upper-b", "lower-a", "upper-a"))?.id).toBe("lower-b");
    expect(pickNextDay(upperLower, done("lower-b", "upper-b", "lower-a", "upper-a"))?.id).toBe("upper-a");
  });

  it("повний прохід 8 тренувань — кожен день двічі, по порядку", () => {
    const history: { program_day_id: string | null }[] = [];
    const sequence: string[] = [];
    for (let i = 0; i < 8; i++) {
      const next = pickNextDay(upperLower, history)!;
      sequence.push(next.id);
      history.unshift({ program_day_id: next.id });
    }
    expect(sequence).toEqual([
      "upper-a", "lower-a", "upper-b", "lower-b",
      "upper-a", "lower-a", "upper-b", "lower-b",
    ]);
  });

  it("2 дні Full Body: A → B → A", () => {
    const fullBody = [{ id: "fb-a" }, { id: "fb-b" }];
    expect(pickNextDay(fullBody, done("fb-a"))?.id).toBe("fb-b");
    expect(pickNextDay(fullBody, done("fb-b", "fb-a"))?.id).toBe("fb-a");
  });

  it("вільні тренування й дні інших програм пропускаються", () => {
    expect(pickNextDay(upperLower, done(null, "other-program-day", "upper-b"))?.id).toBe("lower-b");
  });
});

describe("колишні назви днів Upper / Lower у старих копіях", () => {
  const names = buildTemplateNames([
    { name: "Upper / Lower", name_uk: "Верх / Низ", program_days: [{ name: "Upper A", name_uk: "Верх A" }] },
    ...LEGACY_TEMPLATE_NAMES,
  ]);

  it("перемикаються з мовою, як і нові", () => {
    expect(templateName("Upper", names, "uk")).toBe("Верх");
    expect(templateName("Низ", names, "en")).toBe("Lower");
    expect(templateName("Upper A", names, "uk")).toBe("Верх A");
  });
});

describe("SQL шаблонів: кількість вправ 12 / 25 / 21", () => {
  // Рядки вправ днів: ('2000…0XYY', pos, 'Name', sets, min, max, rest); X — номер шаблону.
  const count = (sql: string) => {
    const perTemplate: Record<string, number> = {};
    for (const m of sql.matchAll(/\('20000000-0000-0000-0000-000000000(\d)\d\d', \d+, '/g)) {
      perTemplate[m[1]] = (perTemplate[m[1]] ?? 0) + 1;
    }
    return perTemplate;
  };
  const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

  it.each(["supabase/migrations/20261119000002_better_templates.sql", "supabase/seed.sql"])("%s", (path) => {
    expect(count(read(path))).toEqual({ "1": 12, "2": 25, "3": 21 });
  });
});
