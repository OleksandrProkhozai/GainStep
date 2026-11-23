import type { PersonalBest, Session } from "@/lib/progression";
import type { Enums } from "@/types/database.types";
import type { PlanSource } from "./plan";

export type MuscleGroup = Enums<"muscle_group">;
export type Equipment = Enums<"equipment_type">;

/** Вправа в активному тренуванні разом з параметрами прогресії та історією. */
export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  /**
   * Українська назва системної вправи. Зберігається в Zustand разом з name,
   * тож після зміни мови назва перемикається без перезавантаження тренування
   * (старі збережені стани без поля показують name).
   */
  nameUk?: string | null;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  /** Крок ваги вправи, кг (exercises.weight_increment). */
  increment: number;
  /** Фото вправи (шлях у bucket); старі збережені стани — без поля. */
  imagePath?: string | null;
  /** Власна вправа — мініатюра за замовчуванням не група м'язів, а фото. */
  custom?: boolean;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /** Базова (багатосуглобова) вправа: 5:00 переходу замість 3:00. Старі стани без поля — ізолююча. */
  isCompound?: boolean;
  /** Власний відпочинок після вправи (program_exercises.transition_rest_seconds); null — авто. */
  transitionRestSeconds?: number | null;
  /** "added" — додана під час тренування (бейдж "Додано"); старі стани без поля — "program". */
  source?: PlanSource;
  /**
   * Останні завершені тренування з цією вправою (від найновішого).
   * Алгоритму прогресії та колонці Previous достатньо двох.
   */
  history: Session[];
  /** Найкращі показники за всю історію — для визначення рекордів. */
  best: PersonalBest | null;
}

/** Підхід у локальному сторі тренування. Вага — завжди в кг. */
export interface WorkoutSet {
  /** Стабільний id на клієнті (номер підходу змінюється при видаленні). */
  clientId: string;
  exerciseId: string;
  setNumber: number;
  /** null — вагу ще не вибрано (вправа без історії). */
  weightKg: number | null;
  reps: number;
  isCompleted: boolean;
  /** ISO-час позначення підходу виконаним. */
  completedAt: string | null;
  /**
   * Чи має підхід рядок у workout_sets (його хоч раз позначали виконаним).
   * Такі підходи синхронізуються й після зняття позначки.
   */
  tracked: boolean;
}

/** Підхід, уже збережений у базі для цього тренування (продовження з іншого пристрою). */
export interface SavedSet {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  isCompleted: boolean;
  completedAt: string | null;
}

/** Усе, що сервер передає екрану тренування. */
export interface WorkoutInit {
  workoutId: string;
  name: string;
  programName: string | null;
  startedAt: string;
  notes: string;
  exercises: WorkoutExercise[];
  savedSets: SavedSet[];
  /** У тренування вже є workouts.exercise_plan; false — старе, склад дозаписується. */
  planStored: boolean;
}

/** Параметри за замовчуванням для вправи, доданої під час тренування. */
export const ADDED_EXERCISE_DEFAULTS = {
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
} as const;
