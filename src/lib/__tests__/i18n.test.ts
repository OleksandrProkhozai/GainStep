import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";

import en from "../../../messages/en.json";
import uk from "../../../messages/uk.json";
import { compareMessages } from "../../../scripts/check-messages.mjs";
import { localeFromAcceptLanguage, resolveLocale } from "../../i18n/config";
import { formatMinutes } from "../dates";
import { exerciseName, localizedName, matchesExerciseQuery } from "../i18n/names";
import { formatVolume, formatWeight, formatWeightValue, unitLabel } from "../units";

describe("messages en/uk", () => {
  it("ключі збігаються в обидва боки, значення непорожні", () => {
    expect(compareMessages(en, uk)).toEqual({ missing: [], extra: [], empty: [] });
    expect(compareMessages(uk, en)).toEqual({ missing: [], extra: [], empty: [] });
  });
});

describe("exerciseName", () => {
  const bench = { name: "Bench Press", nameUk: "Жим штанги лежачи" };
  const custom = { name: "Landmine Press", nameUk: null };

  it("uk бере name_uk, en — name", () => {
    expect(exerciseName(bench, "uk")).toBe("Жим штанги лежачи");
    expect(exerciseName(bench, "en")).toBe("Bench Press");
  });

  it("власна вправа без перекладу — name в обох мовах", () => {
    expect(exerciseName(custom, "uk")).toBe("Landmine Press");
    expect(localizedName({ name: "Push", name_uk: null }, "uk")).toBe("Push");
    expect(localizedName({ name: "Push", name_uk: "Жим" }, "uk")).toBe("Жим");
  });

  it("пошук по обох назвах без урахування регістру", () => {
    expect(matchesExerciseQuery(bench, "жим")).toBe(true);
    expect(matchesExerciseQuery(bench, "BENCH")).toBe(true);
    expect(matchesExerciseQuery(bench, "присід")).toBe(false);
    expect(matchesExerciseQuery(custom, "")).toBe(true);
  });
});

describe("formatWeight з локаллю", () => {
  it("62.5 kg / 62,5 кг", () => {
    expect(formatWeight(62.5, "kg", "en")).toBe("62.5 kg");
    expect(formatWeight(62.5, "kg", "uk")).toBe("62,5 кг");
  });

  it("lb лишається lb, кома в uk", () => {
    expect(formatWeight(62.5, "lb", "uk")).toBe("138 lb");
    expect(unitLabel("lb", "uk")).toBe("lb");
    expect(formatWeightValue(61.25, "kg", "uk")).toBe("61,25");
  });

  it("тоннаж: 12,4k у uk", () => {
    expect(formatVolume(12_400, "kg", "en")).toEqual({ value: "12.4k", unit: "kg" });
    expect(formatVolume(12_400, "kg", "uk")).toEqual({ value: "12,4k", unit: "кг" });
  });

  it("тривалість: 1h 05m / 1 год 05 хв", () => {
    expect(formatMinutes(65, "en")).toBe("1h 05m");
    expect(formatMinutes(65, "uk")).toBe("1 год 05 хв");
    expect(formatMinutes(48, "uk")).toBe("48 хв");
    expect(formatMinutes(48, "en")).toBe("48 min");
  });
});

describe("ICU plural в uk (one / few / many)", () => {
  const t = createTranslator({ locale: "uk", messages: uk, namespace: "workouts.recentList" });
  const tp = createTranslator({ locale: "uk", messages: uk, namespace: "programs.list" });

  it.each([
    [1, "1 підхід"],
    [2, "2 підходи"],
    [5, "5 підходів"],
    [11, "11 підходів"],
    [21, "21 підхід"],
    [22, "22 підходи"],
  ])("%i → %s", (count, text) => {
    expect(t("setsCount", { count })).toBe(text);
  });

  it("дні й вправи", () => {
    expect(tp("meta", { days: 3, exercises: 10 })).toBe("3 дні · 10 вправ");
    expect(tp("meta", { days: 1, exercises: 21 })).toBe("1 день · 21 вправа");
  });

  it("en: one / other", () => {
    const te = createTranslator({ locale: "en", messages: en, namespace: "workouts.recentList" });
    expect(te("setsCount", { count: 1 })).toBe("1 set");
    expect(te("setsCount", { count: 5 })).toBe("5 sets");
  });
});

describe("визначення мови", () => {
  it("профіль > cookie > Accept-Language", () => {
    expect(resolveLocale({ profileLocale: "en", cookieLocale: "uk", acceptLanguage: "uk" })).toBe("en");
    expect(resolveLocale({ profileLocale: null, cookieLocale: "uk", acceptLanguage: "en-US" })).toBe("uk");
    expect(resolveLocale({ cookieLocale: "fr", acceptLanguage: "uk-UA,uk;q=0.9" })).toBe("uk");
    expect(resolveLocale({})).toBe("en");
  });

  it("Accept-Language: uk і ru → uk, інше → en, з урахуванням q", () => {
    expect(localeFromAcceptLanguage("ru-RU,ru;q=0.9")).toBe("uk");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("en-US,uk;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("uk;q=0.9,en;q=0.5")).toBe("uk");
    expect(localeFromAcceptLanguage("de,uk;q=0.5")).toBe("uk");
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });
});
