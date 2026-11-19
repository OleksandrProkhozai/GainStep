import { matchesExerciseQuery } from "@/lib/i18n/names";
import { IMAGE_PATH_RE } from "./images";
import { z } from "@/lib/validations/zod-codes";
import type { Enums } from "@/types/database.types";

export type MuscleGroup = Enums<"muscle_group">;
export type Equipment = Enums<"equipment_type">;

/** Усі значення enum у порядку з міграції (перевірка повноти — нижче). */
export const MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "core",
] as const satisfies readonly MuscleGroup[];

export const EQUIPMENT = [
  "barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell",
] as const satisfies readonly Equipment[];

// Якщо в enum бази з'явиться нове значення — тут буде помилка типів.
type Missing<A extends string, L extends readonly string[]> = Exclude<A, L[number]>;
const _allMuscles: Missing<MuscleGroup, typeof MUSCLE_GROUPS> extends never ? true : never = true;
const _allEquipment: Missing<Equipment, typeof EQUIPMENT> extends never ? true : never = true;
void _allMuscles;
void _allEquipment;

/**
 * Чипи фільтра груп м'язів. Enum дрібніший за чипи макета, тому
 * Arms = biceps + triceps, Legs = quads + hamstrings + glutes + calves.
 */
export const MUSCLE_FILTERS = [
  { id: "chest", groups: ["chest"] },
  { id: "back", groups: ["back"] },
  { id: "legs", groups: ["quads", "hamstrings", "glutes", "calves"] },
  { id: "shoulders", groups: ["shoulders"] },
  { id: "arms", groups: ["biceps", "triceps"] },
  { id: "core", groups: ["core"] },
] as const satisfies readonly { id: string; groups: readonly MuscleGroup[] }[];

export type MuscleFilter = (typeof MUSCLE_FILTERS)[number]["id"];

/** Вправа бібліотеки (як її бачить клієнт). Крок — у кг. */
export interface LibraryExercise {
  id: string;
  name: string;
  /** Українська назва системної вправи (exercises.name_uk); у власних — null. */
  nameUk: string | null;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  incrementKg: number;
  /** Власна вправа користувача (owner_id = user). */
  custom: boolean;
  /** Фото вправи: шлях у bucket exercise-images; null — картинка за замовчуванням. */
  imagePath?: string | null;
}

export interface ExerciseFilter {
  q: string;
  muscle: MuscleFilter | null;
  equipment: Equipment | null;
}

export const EMPTY_FILTER: ExerciseFilter = { q: "", muscle: null, equipment: null };

/** Фільтрація бібліотеки: пошук по name і name_uk без урахування регістру + чипи. */
export function filterExercises<T extends Pick<LibraryExercise, "name" | "muscleGroup" | "equipment"> & { nameUk?: string | null }>(
  list: readonly T[],
  filter: ExerciseFilter,
): T[] {
  const groups = filter.muscle
    ? (MUSCLE_FILTERS.find((f) => f.id === filter.muscle)?.groups as readonly MuscleGroup[] | undefined)
    : undefined;
  return list.filter(
    (e) =>
      matchesExerciseQuery(e, filter.q) &&
      (!groups || groups.includes(e.muscleGroup)) &&
      (!filter.equipment || e.equipment === filter.equipment),
  );
}

/** Значення фільтра з search params (невідомі значення ігноруються). */
export function parseFilter(params: { get(name: string): string | null }): ExerciseFilter {
  const muscle = params.get("muscle");
  const equipment = params.get("equipment");
  return {
    q: params.get("q") ?? "",
    muscle: MUSCLE_FILTERS.some((f) => f.id === muscle) ? (muscle as MuscleFilter) : null,
    equipment: (EQUIPMENT as readonly string[]).includes(equipment ?? "") ? (equipment as Equipment) : null,
  };
}

export const EXERCISE_LIMITS = { nameMin: 2, nameMax: 80, stepMaxKg: 50 } as const;

/** Форма створення / редагування власної вправи. Крок — в одиницях користувача. */
export const exerciseFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(EXERCISE_LIMITS.nameMin, "exerciseNameMin")
    .max(EXERCISE_LIMITS.nameMax, "exerciseNameMax"),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
  weightStep: z.number({ error: "weightStepRequired" }).positive("weightStepPositive"),
  unit: z.enum(["kg", "lb"]),
  /** Шлях фото в bucket ("<user id>/<uuid>.webp"); null — картинка за замовчуванням. */
  imagePath: z.string().regex(IMAGE_PATH_RE, "exerciseImageInvalid").nullable().default(null),
});

export type ExerciseFormInput = z.input<typeof exerciseFormSchema>;
export type ExerciseFormData = z.output<typeof exerciseFormSchema>;
