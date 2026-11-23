import { describe, expect, it } from "vitest";

import { CUSTOM_PROGRAM_IMAGE, programThumbSrc } from "../programs/images";
import { TEMPLATE_IDS } from "../programs/templates";

const URL = "https://abc.supabase.co";
const USER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const FILE = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const MINE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("мініатюра програми", () => {
  it("власне фото має пріоритет — навіть у копії шаблону", () => {
    expect(
      programThumbSrc(
        { id: MINE, sourceTemplateId: TEMPLATE_IDS.fullBody, imagePath: `${USER}/${FILE}.webp`, custom: true },
        URL,
      ),
    ).toBe(`${URL}/storage/v1/object/public/program-images/${USER}/${FILE}.webp`);
  });

  it("шаблон — картинка шаблону", () => {
    expect(programThumbSrc({ id: TEMPLATE_IDS.upperLower }, URL)).toBe("/programs/upper-lower-v2.webp");
  });

  it("копія шаблону без фото — та сама картинка, що в шаблону", () => {
    expect(programThumbSrc({ id: MINE, sourceTemplateId: TEMPLATE_IDS.pushPullLegs, custom: true }, URL)).toBe(
      "/programs/push-pull-legs.webp",
    );
    expect(programThumbSrc({ id: MINE, sourceTemplateId: "unknown", custom: true }, URL)).toBe(CUSTOM_PROGRAM_IMAGE);
  });

  it("власна програма без фото — картинка за замовчуванням", () => {
    expect(programThumbSrc({ id: MINE, sourceTemplateId: null, imagePath: null, custom: true }, URL)).toBe(
      CUSTOM_PROGRAM_IMAGE,
    );
  });

  it("невідома не власна програма — null (плитка з ініціалами)", () => {
    expect(programThumbSrc({ id: MINE }, URL)).toBeNull();
  });
});
