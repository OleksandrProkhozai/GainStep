"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { signIn, signUp, type ActionResult } from "@/lib/auth/actions";
import {
  signInSchema,
  signUpSchema,
  type SignInValues,
  type SignUpValues,
} from "@/lib/validations/auth";
import { AuthHeader } from "./auth-shell";
import { IconInput, PasswordInput } from "./form-fields";
import { GoogleButton } from "./google-button";
import { SubmitButton } from "./submit-button";

/** Тост результату дії: коди → текст мовою інтерфейсу. */
function useResultToast() {
  const t = useTranslations("auth.messages");
  const errorText = useErrorText();
  return (result: ActionResult | undefined) => {
    if (!result) return;
    if ("error" in result) toast.error(errorText(result.error));
    else toast.success(t(result.message));
  };
}

/** Форма входу/реєстрації; режим перемикається через ?mode=signup. */
export function AuthForm() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const isSignUp = searchParams.get("mode") === "signup";
  const callbackError = searchParams.get("error");

  useEffect(() => {
    if (callbackError) {
      toast.error(t("callbackFailed"));
    }
  }, [callbackError, t]);

  return (
    <>
      {isSignUp ? (
        <AuthHeader
          title={t("signUp.title")}
          accent={t("signUp.accent")}
          subtitle={t("signUp.subtitle")}
        />
      ) : (
        <AuthHeader
          title={t("signIn.title")}
          accent={t("signIn.accent")}
          subtitle={t("signIn.subtitle")}
        />
      )}

      {isSignUp ? <SignUpForm /> : <SignInForm />}
      <LegalLinks />
    </>
  );
}

/** Посилання на політику конфіденційності та умови (потрібні для Google OAuth). */
function LegalLinks() {
  const t = useTranslations("auth");
  return (
    <p className="mt-5 text-center text-xs text-white/40 md:mt-6">
      <Link href="/privacy" className="underline-offset-2 hover:text-white/70 hover:underline">
        {t("privacyLink")}
      </Link>{" "}
      {t("legalAnd")}{" "}
      <Link href="/terms" className="underline-offset-2 hover:text-white/70 hover:underline">
        {t("termsLink")}
      </Link>
    </p>
  );
}

function SignInForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const handleResult = useResultToast();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  // Помилку сервера (напр. неправильний пароль) показуємо під полем пароля,
  // а не лише тостом: на телефоні тост легко не помітити.
  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const result = await signIn(values);
      if (result && "error" in result) {
        setError("password", { type: "server", message: result.error });
      } else {
        handleResult(result);
      }
    }),
  );

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-3 md:space-y-4">
        <IconInput
          icon={Mail}
          label={t("email")}
          type="email"
          autoComplete="email"
          error={errorText(errors.email?.message)}
          {...register("email")}
        />
        <div className="space-y-1.5 md:space-y-2">
          <PasswordInput
            label={t("password")}
            autoComplete="current-password"
            error={errorText(errors.password?.message)}
            {...register("password")}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="pr-2 text-[13px] font-medium text-[#c6f432] hover:underline"
            >
              {t("forgotLink")}
            </Link>
          </div>
        </div>
        <SubmitButton pending={pending}>{t("signIn.submit")}</SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton disabled={pending} />

      <p className="mt-4 text-center text-sm text-white/55 md:mt-6 md:text-[15px]">
        {t("noAccount")}{" "}
        <Link
          href="/login?mode=signup"
          className="font-semibold text-[#c6f432] hover:underline"
        >
          {t("signUp.link")}
        </Link>
      </p>
    </>
  );
}

function SignUpForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const handleResult = useResultToast();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => handleResult(await signUp(values))),
  );

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-3 md:space-y-4">
        <IconInput
          icon={Mail}
          label={t("email")}
          type="email"
          autoComplete="email"
          error={errorText(errors.email?.message)}
          {...register("email")}
        />
        <PasswordInput
          label={t("password")}
          autoComplete="new-password"
          error={errorText(errors.password?.message)}
          {...register("password")}
        />
        <PasswordInput
          label={t("confirmPassword")}
          autoComplete="new-password"
          error={errorText(errors.confirmPassword?.message)}
          {...register("confirmPassword")}
        />
        <SubmitButton pending={pending}>{t("signUp.submit")}</SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton disabled={pending} />

      <p className="mt-4 text-center text-sm text-white/55 md:mt-6 md:text-[15px]">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold text-[#c6f432] hover:underline"
        >
          {t("signIn.link")}
        </Link>
      </p>
    </>
  );
}

function OrDivider() {
  const t = useTranslations("auth");
  return (
    <div className="my-4 flex items-center gap-4 text-sm text-white/45 md:my-6">
      <span className="h-px flex-1 bg-white/10" />
      {t("or")}
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
