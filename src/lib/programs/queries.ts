import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryExercise } from "@/lib/exercises/catalog";
import { loadExerciseSessions } from "@/lib/workout/queries";
import { localizedName } from "@/lib/i18n/names";
import { getTemplateNames, templateName } from "./template-names";
import type { Database } from "@/types/database.types";
import type { ProgramDraft } from "./draft";
import { toRecentHistory, type RecentHistory } from "./next";

type Client = SupabaseClient<Database>;

export type ProgramCard = {
  id: string;
  name: string;
  isTemplate: boolean;
  isActive: boolean;
  /** Шаблон, з якого склоновано програму (для картинки ProgramThumb). */
  sourceTemplateId: string | null;
  /** Назви днів за position. */
  days: { id: string; name: string }[];
  exerciseCount: number;
};

export type ProgramsList = {
  activeProgramId: string | null;
  mine: ProgramCard[];
  templates: ProgramCard[];
};

/**
 * Список програм: власні (активна — першою) і шаблони, одним запитом
 * разом із профілем. Кількість вправ рахує PostgREST (count), без N+1.
 */
/** locale — назви шаблонів і їхніх днів (name_uk); власні програми не перекладаються. */
export async function getProgramsList(supabase: Client, userId: string, locale: string): Promise<ProgramsList> {
  const [profileRes, programsRes, templateNames] = await Promise.all([
    supabase.from("profiles").select("active_program_id").eq("id", userId).maybeSingle(),
    supabase
      .from("programs")
      .select("id, name, name_uk, owner_id, source_template_id, created_at, program_days ( id, name, name_uk, position, program_exercises ( count ) )")
      .order("created_at", { ascending: true }),
    getTemplateNames(supabase),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (programsRes.error) throw programsRes.error;

  const activeProgramId = profileRes.data?.active_program_id ?? null;
  const cards = programsRes.data.map((p): ProgramCard => {
    const days = [...p.program_days].sort((a, b) => a.position - b.position);
    return {
      id: p.id,
      // Шаблон — name_uk; копія шаблону зі стандартною назвою — теж мовою інтерфейсу.
      name: templateName(localizedName(p, locale), templateNames, locale),
      isTemplate: p.owner_id === null,
      isActive: p.id === activeProgramId,
      sourceTemplateId: p.source_template_id,
      days: days.map((d) => ({ id: d.id, name: templateName(localizedName(d, locale), templateNames, locale) })),
      exerciseCount: days.reduce((sum, d) => sum + (d.program_exercises[0]?.count ?? 0), 0),
    };
  });

  return {
    activeProgramId,
    mine: cards
      .filter((c) => !c.isTemplate)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    templates: cards.filter((c) => c.isTemplate),
  };
}

const LIBRARY_COLUMNS = "id, name, name_uk, muscle_group, equipment, weight_increment, owner_id";

type LibraryRow = {
  id: string;
  name: string;
  name_uk: string | null;
  muscle_group: LibraryExercise["muscleGroup"];
  equipment: LibraryExercise["equipment"];
  weight_increment: number;
  owner_id: string | null;
};

export function toLibraryExercise(row: LibraryRow): LibraryExercise {
  return {
    id: row.id,
    name: row.name,
    nameUk: row.name_uk,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    incrementKg: Number(row.weight_increment),
    custom: row.owner_id !== null,
  };
}

/** Бібліотека вправ: системні + власні (RLS), за назвою. */
export async function getExerciseLibrary(supabase: Client): Promise<LibraryExercise[]> {
  const { data, error } = await supabase.from("exercises").select(LIBRARY_COLUMNS).order("name");
  if (error) throw error;
  return data.map(toLibraryExercise);
}

export type ProgramEditorData = {
  program: {
    id: string;
    name: string;
    isTemplate: boolean;
    isActive: boolean;
    /** Шаблон, з якого склоновано програму (для картинки ProgramThumb). */
    sourceTemplateId: string | null;
    /** updated_at — змінюється після кожного збереження (скидання чернетки). */
    version: string;
  };
  draft: ProgramDraft;
  library: LibraryExercise[];
  /** Два останні тренування кожної вправи бібліотеки — для чипа Next. */
  history: RecentHistory;
};

/**
 * Дані редактора. Дві хвилі запитів:
 *  1) програма з днями й вправами + бібліотека вправ;
 *  2) історія всіх вправ бібліотеки одним запитом (loadExerciseSessions) —
 *     так чип Next одразу працює і для вправ, доданих через picker.
 * Чужа або неіснуюча програма → null (RLS її не поверне).
 */
export async function getProgramEditor(
  supabase: Client,
  programId: string,
  activeProgramId: string | null,
  locale: string,
): Promise<ProgramEditorData | null> {
  const [programRes, library, templateNames] = await Promise.all([
    supabase
      .from("programs")
      .select(
        `id, name, name_uk, owner_id, source_template_id, updated_at,
         program_days ( id, name, name_uk, position,
           program_exercises ( id, position, exercise_id, target_sets, rep_min, rep_max, rest_seconds,
             exercise:exercises ( ${LIBRARY_COLUMNS} ) ) )`,
      )
      .eq("id", programId)
      .maybeSingle(),
    getExerciseLibrary(supabase),
    getTemplateNames(supabase),
  ]);
  if (programRes.error) throw programRes.error;
  const program = programRes.data;
  if (!program) return null;

  const sessions = await loadExerciseSessions(
    supabase,
    library.map((e) => e.id),
  );

  const days = [...program.program_days].sort((a, b) => a.position - b.position);
  return {
    program: {
      id: program.id,
      name: templateName(localizedName(program, locale), templateNames, locale),
      isTemplate: program.owner_id === null,
      isActive: program.id === activeProgramId,
      sourceTemplateId: program.source_template_id,
      version: program.updated_at,
    },
    draft: {
      // Шаблон (лише перегляд) — мовою інтерфейсу; у власних name_uk порожнє.
      name: templateName(localizedName(program, locale), templateNames, locale),
      days: days.map((d) => ({
        key: d.id,
        id: d.id,
        name: templateName(localizedName(d, locale), templateNames, locale),
        exercises: [...d.program_exercises]
          .sort((a, b) => a.position - b.position)
          .filter((pe) => pe.exercise !== null)
          .map((pe) => ({
            key: pe.id,
            id: pe.id,
            exerciseId: pe.exercise_id,
            name: pe.exercise!.name,
            nameUk: pe.exercise!.name_uk,
            muscleGroup: pe.exercise!.muscle_group,
            equipment: pe.exercise!.equipment,
            incrementKg: Number(pe.exercise!.weight_increment),
            targetSets: pe.target_sets,
            repMin: pe.rep_min,
            repMax: pe.rep_max,
            restSeconds: pe.rest_seconds,
          })),
      })),
    },
    library,
    history: toRecentHistory(sessions),
  };
}
