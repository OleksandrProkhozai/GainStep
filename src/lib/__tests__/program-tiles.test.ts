import { describe, expect, it } from "vitest";

import { MUSCLE_GROUPS } from "../exercises/catalog";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MUSCLE_IMAGE, MUSCLE_FAMILY_COLORS, MUSCLE_IMAGES, MUSCLE_STYLES, muscleImage, muscleStyle } from "../exercises/muscles";
import { programInitials } from "../programs/initials";

describe("programInitials", () => {
  it("перші літери слів", () => {
    expect(programInitials("Full Body")).toBe("FB");
    expect(programInitials("Push Pull Legs")).toBe("PPL");
  });

  it("символи ігноруються", () => {
    expect(programInitials("Upper / Lower")).toBe("UL");
    expect(programInitials("  5x5 — Strength!  ")).toBe("5S");
  });

  it("максимум 3 літери, верхній регістр", () => {
    expect(programInitials("my push pull legs split")).toBe("MPP");
  });

  it("одне слово — дві літери; порожньо — ?", () => {
    expect(programInitials("Strength")).toBe("ST");
    expect(programInitials("A")).toBe("A");
    expect(programInitials(" / ")).toBe("?");
    expect(programInitials("")).toBe("?");
  });

  it("кирилиця", () => {
    expect(programInitials("Верх низ")).toBe("ВН");
  });
});

describe("MUSCLE_STYLES", () => {
  it("покриває всі групи enum двобуквеними кодами", () => {
    for (const g of MUSCLE_GROUPS) expect(MUSCLE_STYLES[g].code).toMatch(/^[A-Z]{2}$/);
    expect(new Set(MUSCLE_GROUPS.map((g) => MUSCLE_STYLES[g].code)).size).toBe(MUSCLE_GROUPS.length);
  });

  it("схожі групи — одна кольорова родина, без лаймового", () => {
    expect(MUSCLE_STYLES.quads.color).toBe(MUSCLE_STYLES.calves.color);
    expect(MUSCLE_STYLES.biceps.color).toBe(MUSCLE_STYLES.triceps.color);
    expect(Object.values(MUSCLE_FAMILY_COLORS).map((c) => c.toUpperCase())).not.toContain("#C6F432");
  });

  it("невідома група — сіра", () => {
    expect(muscleStyle("forearms")).toEqual({ code: "FO", family: "other", color: "#8A8F98" });
  });
});

describe("MUSCLE_IMAGES", () => {
  it("картинка для кожної групи enum, файл існує в public/", () => {
    for (const g of MUSCLE_GROUPS) {
      expect(MUSCLE_IMAGES[g]).toBe(`/muscles/${g}.webp`);
      expect(fs.existsSync(path.join("public", MUSCLE_IMAGES[g]))).toBe(true);
    }
    expect(fs.existsSync(path.join("public", DEFAULT_MUSCLE_IMAGE))).toBe(true);
  });

  it("невідома або порожня група — default.webp", () => {
    expect(muscleImage("forearms")).toBe("/muscles/default.webp");
    expect(muscleImage(null)).toBe("/muscles/default.webp");
    expect(muscleImage("chest")).toBe("/muscles/chest.webp");
  });
});
