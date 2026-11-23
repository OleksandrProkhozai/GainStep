import { describe, expect, it } from "vitest";

import { programImage } from "../programs/template-images";

const FULL_BODY = "10000000-0000-0000-0000-000000000001";
const UPPER_LOWER = "10000000-0000-0000-0000-000000000002";
const PPL = "10000000-0000-0000-0000-000000000003";

describe("programImage", () => {
  it("шаблон — за id", () => {
    expect(programImage({ id: FULL_BODY })).toBe("/programs/full-body-v2.webp");
    expect(programImage({ id: UPPER_LOWER })).toBe("/programs/upper-lower-v2.webp");
    expect(programImage({ id: PPL })).toBe("/programs/push-pull-legs.webp");
  });

  it("копія шаблону — за source_template_id", () => {
    expect(programImage({ id: "my-program", sourceTemplateId: PPL })).toBe("/programs/push-pull-legs.webp");
  });

  it("власна програма без шаблону — null (плитка з ініціалами)", () => {
    expect(programImage({ id: "my-program" })).toBeNull();
    expect(programImage({ id: "my-program", sourceTemplateId: null })).toBeNull();
    expect(programImage({ id: "my-program", sourceTemplateId: "unknown" })).toBeNull();
  });
});
