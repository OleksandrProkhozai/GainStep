import { describe, expect, it } from "vitest";

import {
  CUSTOM_EXERCISE_IMAGE,
  exerciseImageUrl,
  exerciseThumbSrc,
  isOwnImagePath,
  newImagePath,
} from "../exercises/images";
import { exerciseFormSchema } from "../exercises/catalog";

const USER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const OTHER = "11111111-2222-4333-8444-555555555555";
const FILE = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const URL = "https://abc.supabase.co";

describe("мініатюра вправи", () => {
  it("власне фото → public URL з bucket", () => {
    expect(exerciseThumbSrc({ muscleGroup: "chest", imagePath: `${USER}/${FILE}.webp`, custom: true }, URL)).toBe(
      `${URL}/storage/v1/object/public/exercise-images/${USER}/${FILE}.webp`,
    );
  });

  it("власна вправа без фото → картинка за замовчуванням", () => {
    expect(exerciseThumbSrc({ muscleGroup: "chest", imagePath: null, custom: true }, URL)).toBe(CUSTOM_EXERCISE_IMAGE);
  });

  it("системна вправа → картинка групи м'язів", () => {
    expect(exerciseThumbSrc({ muscleGroup: "back" }, URL)).toBe("/muscles/back.webp");
  });

  it("URL без шляху — null; зайвий слеш у кінці адреси Supabase не дублюється", () => {
    expect(exerciseImageUrl(null, URL)).toBeNull();
    expect(exerciseImageUrl("a/b.webp", `${URL}/`)).toBe(`${URL}/storage/v1/object/public/exercise-images/a/b.webp`);
  });
});

describe("шлях фото в bucket", () => {
  it("лише своя папка й формат <uuid>/<uuid>.webp|jpg", () => {
    expect(isOwnImagePath(newImagePath(USER, FILE), USER)).toBe(true);
    expect(isOwnImagePath(newImagePath(USER, FILE, "jpg"), USER)).toBe(true);
    expect(isOwnImagePath(newImagePath(OTHER, FILE), USER)).toBe(false);
    expect(isOwnImagePath(`${USER}/../${OTHER}/${FILE}.webp`, USER)).toBe(false);
    expect(isOwnImagePath(`${USER}/${FILE}.svg`, USER)).toBe(false);
    expect(isOwnImagePath(`https://evil.example/${FILE}.webp`, USER)).toBe(false);
  });

  it("форма вправи: фото необов'язкове, чужий формат відхиляється", () => {
    const base = { name: "Cable Fly", muscleGroup: "chest", equipment: "cable", weightStep: 5, unit: "kg" } as const;
    expect(exerciseFormSchema.parse(base).imagePath).toBeNull();
    expect(exerciseFormSchema.parse({ ...base, imagePath: `${USER}/${FILE}.webp` }).imagePath).toBe(`${USER}/${FILE}.webp`);
    expect(exerciseFormSchema.safeParse({ ...base, imagePath: "../secret.png" }).error?.issues[0]?.message).toBe(
      "exerciseImageInvalid",
    );
  });
});
