"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  onboardingSchema,
  toKg,
  type OnboardingInput,
} from "@/lib/validations/onboarding";

export type OnboardingResult = { error: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Дата запису ваги: локальна дата клієнта, якщо вона в межах доби від
 * серверної (часові пояси), інакше — серверна UTC-дата.
 */
function resolveRecordedOn(clientDate: string) {
  const serverDate = new Date().toISOString().slice(0, 10);
  const diff = Math.abs(Date.parse(clientDate) - Date.parse(serverDate));
  return diff <= DAY_MS ? clientDate : serverDate;
}

/**
 * Завершення онбордингу. Кроки ідемпотентні, щоб повторна спроба після
 * помилки не створювала дублікатів: вага — upsert на дату, програма —
 * повторно використовується, якщо вже клонована з цього шаблону.
 * onboarded_at записується останнім.
 */
export async function completeOnboarding(
  values: OnboardingInput,
): Promise<OnboardingResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your answers" };
  }
  const { weight, unit, experience, goal, templateId, today } = parsed.data;

  // 1. Уже пройдено — нічого не перезаписуємо.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("onboarding: load profile", profileError);
    return { error: "Couldn't load your profile. Please try again." };
  }
  if (profile.onboarded_at) redirect("/");

  // 2. Вага тіла (завжди в кг) на сьогодні.
  const { error: weightError } = await supabase
    .from("body_weight_entries")
    .upsert(
      {
        user_id: userId,
        weight: toKg(weight, unit),
        recorded_on: resolveRecordedOn(today),
      },
      { onConflict: "user_id,recorded_on" },
    );
  if (weightError) {
    console.error("onboarding: body weight", weightError);
    return { error: "Couldn't save your body weight. Please try again." };
  }

  // 3. Рівень, ціль, одиниці.
  const { error: prefsError } = await supabase
    .from("profiles")
    .update({ experience, goal, unit })
    .eq("id", userId);
  if (prefsError) {
    console.error("onboarding: preferences", prefsError);
    return { error: "Couldn't save your preferences. Please try again." };
  }

  // 4. Програма з шаблону (для Custom — без програми).
  let activeProgramId: string | null = null;
  if (templateId) {
    const programId = await getOrCloneProgram(supabase, userId, templateId);
    if ("error" in programId) return programId;
    activeProgramId = programId.id;
  }

  // 5. Фіналізація — лише коли все попереднє вдалося.
  const { error: finishError } = await supabase
    .from("profiles")
    .update({
      active_program_id: activeProgramId,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (finishError) {
    console.error("onboarding: finish", finishError);
    return { error: "Couldn't finish setup. Please try again." };
  }

  redirect("/");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getOrCloneProgram(
  supabase: Supabase,
  userId: string,
  templateId: string,
): Promise<{ id: string } | OnboardingResult> {
  // Програма вже клонована попередньою (невдалою) спробою?
  const { data: existing, error: existingError } = await supabase
    .from("programs")
    .select("id")
    .eq("owner_id", userId)
    .eq("source_template_id", templateId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    console.error("onboarding: find program", existingError);
    return { error: "Couldn't set up your program. Please try again." };
  }
  if (existing) return { id: existing.id };

  // Клонуємо лише справжні шаблони (owner_id is null).
  const { data: template, error: templateError } = await supabase
    .from("programs")
    .select("id")
    .eq("id", templateId)
    .is("owner_id", null)
    .maybeSingle();
  if (templateError || !template) {
    console.error("onboarding: template", templateError);
    return { error: "This program is no longer available." };
  }

  const { data: newId, error: cloneError } = await supabase.rpc(
    "clone_program",
    { template_id: templateId },
  );
  if (cloneError || !newId) {
    console.error("onboarding: clone program", cloneError);
    return { error: "Couldn't set up your program. Please try again." };
  }
  return { id: newId };
}
