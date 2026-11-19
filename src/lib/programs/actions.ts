"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getRequestLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { z } from "@/lib/validations/zod-codes";
import { isOwnImagePath, newImagePath } from "@/lib/images/storage";
import { PROGRAM_IMAGES_BUCKET } from "./images";
import { firstIssue, programNameSchema, saveProgramSchema } from "./schema";

/** error — код повідомлення (errors.*); текст підставляє клієнт. */
export type ProgramActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.guid();

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/** Сторінки, що показують програми: список, редактор, дашборд, хаб тренувань. */
function revalidatePrograms(programId?: string) {
  revalidatePath("/programs");
  if (programId) revalidatePath(`/programs/${programId}`);
  revalidatePath("/");
  revalidatePath("/workouts");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Прибрати фото програми з bucket (заміна, видалення). Не критично — лише лог. */
async function removeProgramImage(supabase: Supabase, path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(PROGRAM_IMAGES_BUCKET).remove([path]);
  if (error) console.error("removeProgramImage", error);
}

/**
 * Фото власної програми: шлях з папки користувача в bucket або null
 * (картинка за замовчуванням). Попереднє фото прибирається з bucket.
 */
export async function setProgramImage(programId: string, imagePath: string | null): Promise<ProgramActionResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(programId).success) return { ok: false, error: "programNotFound" };
  if (imagePath !== null && !isOwnImagePath(imagePath, userId)) return { ok: false, error: "programImageInvalid" };

  const { data: previous } = await supabase
    .from("programs")
    .select("image_path")
    .eq("id", programId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!previous) return { ok: false, error: "programNotFound" };

  const { error } = await supabase
    .from("programs")
    .update({ image_path: imagePath })
    .eq("id", programId)
    .eq("owner_id", userId);
  if (error) {
    console.error("setProgramImage", error);
    return { ok: false, error: "programImageFailed" };
  }
  if (previous.image_path !== imagePath) await removeProgramImage(supabase, previous.image_path);

  revalidatePrograms(programId);
  return { ok: true };
}

/** Робить програму активною, якщо в користувача активної ще немає. */
async function activateIfNone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  programId: string,
) {
  const { error } = await supabase
    .from("profiles")
    .update({ active_program_id: programId })
    .eq("id", userId)
    .is("active_program_id", null);
  if (error) console.error("activateIfNone", error);
}

/**
 * «Use template»: копія шаблону через RPC clone_program. Копія стає
 * активною лише якщо активної програми ще немає. Далі — редактор копії.
 */
export async function cloneTemplate(templateId: string, _formData?: FormData) {
  void _formData;
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(templateId).success) redirect("/programs");

  const { data: template } = await supabase
    .from("programs")
    .select("id")
    .eq("id", templateId)
    .is("owner_id", null)
    .maybeSingle();
  if (!template) redirect("/programs");

  // Копія отримує назви мовою інтерфейсу (name_uk для uk); далі це дані користувача.
  const { data: newId, error } = await supabase.rpc("clone_program", {
    template_id: templateId,
    p_locale: await getRequestLocale(),
  });
  if (error || !newId) {
    console.error("cloneTemplate", error);
    throw new Error("cloneTemplate failed");
  }
  await activateIfNone(supabase, userId, newId);

  revalidatePrograms(newId);
  redirect(`/programs/${newId}`);
}

/** «+ New program»: програма з одним днем «Day 1». */
export async function createProgram(name: string): Promise<{ ok: false; error: string }> {
  const { supabase, userId } = await requireUser();
  const parsed = programNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { data: program, error } = await supabase
    .from("programs")
    .insert({ owner_id: userId, name: parsed.data, days_per_week: 1 })
    .select("id")
    .single();
  if (error) {
    console.error("createProgram", error);
    return { ok: false, error: "programCreateFailed" };
  }

  const { error: dayError } = await supabase
    .from("program_days")
    .insert({ program_id: program.id, name: (await getTranslations("programs"))("dayN", { n: 1 }), position: 0 });
  if (dayError) {
    console.error("createProgram: day", dayError);
    await supabase.from("programs").delete().eq("id", program.id);
    return { ok: false, error: "programCreateFailed" };
  }

  revalidatePrograms(program.id);
  redirect(`/programs/${program.id}`);
}

/**
 * Збереження редактора: один виклик RPC save_program (одна транзакція).
 * Payload ще раз валідується тут — клієнту не довіряємо.
 */
export async function saveProgram(programId: string, payload: unknown): Promise<ProgramActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(programId).success) return { ok: false, error: "programNotFound" };
  const parsed = saveProgramSchema.safeParse(payload);
  if (!parsed.success) {
    // Помилки з назвою дня ({day}) клієнт показує сам, до виклику; тут — загальний код.
    const code = firstIssue(parsed.error);
    return { ok: false, error: code === "dayNeedsExercise" || code === "dayDuplicateExercise" ? "programInvalid" : code };
  }

  const { error } = await supabase.rpc("save_program", {
    p_program_id: programId,
    p_payload: parsed.data,
  });
  if (error) {
    console.error("saveProgram", error);
    if (error.code === "PGRST202") {
      return { ok: false, error: "saveNotSetUp" };
    }
    if (error.code === "P0002") return { ok: false, error: "programNotFound" };
    // 22023 — перевірки save_program (день без вправ тощо): клієнт їх уже
    // показав би; сюди доходимо лише в обхід клієнта.
    if (error.code === "22023") return { ok: false, error: "programInvalid" };
    return { ok: false, error: "programSaveFailed" };
  }

  revalidatePrograms(programId);
  return { ok: true };
}

export async function setActiveProgram(programId: string): Promise<ProgramActionResult> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(programId).success) return { ok: false, error: "programNotFound" };

  // Лише власна програма (шаблон спершу копіюється).
  const { data: own } = await supabase
    .from("programs")
    .select("id")
    .eq("id", programId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!own) return { ok: false, error: "programNotFound" };

  const { error } = await supabase.from("profiles").update({ active_program_id: programId }).eq("id", userId);
  if (error) {
    console.error("setActiveProgram", error);
    return { ok: false, error: "activeProgramFailed" };
  }
  revalidatePrograms(programId);
  return { ok: true };
}

/**
 * Duplicate: clone_program працює і з власними програмами (RLS дозволяє
 * читати свої), після чого копію перейменовуємо на «… (copy)».
 */
export async function duplicateProgram(programId: string): Promise<{ ok: false; error: string }> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(programId).success) return { ok: false, error: "programNotFound" };

  const { data: source } = await supabase
    .from("programs")
    .select("name, image_path")
    .eq("id", programId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!source) return { ok: false, error: "programNotFound" };

  const { data: newId, error } = await supabase.rpc("clone_program", { template_id: programId });
  if (error || !newId) {
    console.error("duplicateProgram", error);
    return { ok: false, error: "programDuplicateFailed" };
  }
  const t = await getTranslations("programs");
  const name = t("copyName", { name: source.name.slice(0, 50) });
  // Фото — окремою копією файлу: видалення однієї програми не зачепить іншу.
  let image_path: string | null = null;
  if (source.image_path) {
    const copy = newImagePath(userId, crypto.randomUUID(), source.image_path.endsWith(".jpg") ? "jpg" : "webp");
    const { error: copyError } = await supabase.storage.from(PROGRAM_IMAGES_BUCKET).copy(source.image_path, copy);
    if (copyError) console.error("duplicateProgram: image", copyError);
    else image_path = copy;
  }
  await supabase.from("programs").update({ name, image_path }).eq("id", newId);

  revalidatePrograms(newId);
  redirect(`/programs/${newId}`);
}

/**
 * Видалення програми. Дні й вправи програми видаляються каскадом, історія
 * тренувань лишається (workouts.program_day_id → set null), а
 * profiles.active_program_id стає null (on delete set null).
 */
export async function deleteProgram(programId: string): Promise<{ ok: false; error: string }> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(programId).success) return { ok: false, error: "programNotFound" };

  const { data, error } = await supabase
    .from("programs")
    .delete()
    .eq("id", programId)
    .eq("owner_id", userId)
    .select("id, image_path");
  if (error) {
    console.error("deleteProgram", error);
    return { ok: false, error: "programDeleteFailed" };
  }
  if (data.length === 0) return { ok: false, error: "programNotFound" };
  await removeProgramImage(supabase, data[0].image_path);

  revalidatePrograms();
  redirect("/programs");
}
