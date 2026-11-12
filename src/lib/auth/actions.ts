"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

/** Результат дії, якщо вона не завершилась редіректом. */
export type ActionResult = { error: string } | { message: string };

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
  if (!parsed.success) return { error: "Invalid email or password" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect(await getPostAuthPath(supabase, data.user.id));
}

export async function signUp(values: SignUpValues): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the form fields" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: error.message };

  // Якщо в проєкті ввімкнено підтвердження email — сесії ще немає.
  if (!data.session) {
    return { message: "Check your email to confirm your account" };
  }

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
  if (!parsed.success) return { error: "Enter a valid email address" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${await getOrigin()}/auth/callback?next=/reset-password` },
  );
  if (error) return { error: error.message };

  return { message: "Check your email" };
}

export async function updatePassword(
  values: ResetPasswordValues,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the form fields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  redirect("/");
}
