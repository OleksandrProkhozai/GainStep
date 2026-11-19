"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorCode, type AuthErrorCode } from "@/lib/auth/errors";
import { syncLocaleAfterAuth } from "@/lib/auth/locale";
import { getPostAuthPath } from "@/lib/auth/redirects";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from "@/lib/validations/auth";

/**
 * Результат дії, якщо вона не завершилась редіректом. Лише КОДИ:
 * error — errors.*, message — auth.messages.*; текст підставляє клієнт.
 */
export type ActionResult = { error: AuthErrorCode | "invalidForm" } | { message: "checkEmail" | "checkEmailReset" };

async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signIn(values: SignInValues): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { error: "invalidCredentials" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorCode(error) };

  await syncLocaleAfterAuth(supabase, data.user.id);
  redirect(await getPostAuthPath(supabase, data.user.id));
}

export async function signUp(values: SignUpValues): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { error: "invalidForm" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: authErrorCode(error) };

  // Якщо в проєкті ввімкнено підтвердження email — сесії ще немає
  // (мову профілю виставить /auth/callback після підтвердження).
  if (!data.session) {
    return { message: "checkEmail" };
  }

  if (data.user) await syncLocaleAfterAuth(supabase, data.user.id);
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  values: ForgotPasswordValues,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: "invalidForm" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${await getOrigin()}/auth/callback?next=/reset-password` },
  );
  if (error) return { error: authErrorCode(error) };

  return { message: "checkEmailReset" };
}

export async function updatePassword(
  values: ResetPasswordValues,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: "invalidForm" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: authErrorCode(error) };

  redirect("/");
}
