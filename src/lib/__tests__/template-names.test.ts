import { describe, expect, it } from "vitest";

import { buildTemplateNames, templateName } from "../programs/template-names";

const names = buildTemplateNames([
  {
    name: "Full Body",
    name_uk: "Все тіло",
    program_days: [
      { name: "Full Body A", name_uk: "Все тіло A" },
      { name: "Full Body B", name_uk: "Все тіло B" },
    ],
  },
  { name: "Upper / Lower", name_uk: null, program_days: null },
]);

describe("templateName — стандартні назви копій шаблонів мовою інтерфейсу", () => {
  it("англійська збережена назва → українська для uk", () => {
    expect(templateName("Full Body", names, "uk")).toBe("Все тіло");
    expect(templateName("Full Body B", names, "uk")).toBe("Все тіло B");
  });

  it("українська збережена назва → англійська для en", () => {
    expect(templateName("Все тіло A", names, "en")).toBe("Full Body A");
    expect(templateName("Все тіло", names, "en")).toBe("Full Body");
  });

  it("та сама мова — без змін", () => {
    expect(templateName("Все тіло B", names, "uk")).toBe("Все тіло B");
    expect(templateName("Full Body A", names, "en")).toBe("Full Body A");
  });

  it("перейменована користувачем назва — як є", () => {
    expect(templateName("Мій спліт", names, "en")).toBe("Мій спліт");
    expect(templateName("Full Body A (heavy)", names, "uk")).toBe("Full Body A (heavy)");
  });

  it("шаблон без перекладу — англійська назва", () => {
    expect(templateName("Upper / Lower", names, "uk")).toBe("Upper / Lower");
  });
});
