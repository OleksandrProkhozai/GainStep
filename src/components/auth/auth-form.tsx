"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { toast } from "sonner";
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

function handleResult(result: ActionResult | undefined) {
  if (!result) return;
  if ("error" in result) toast.error(result.error);
  else toast.success(result.message);
}

/** Форма входу/реєстрації; режим перемикається через ?mode=signup. */
export function AuthForm() {
  const searchParams = useSearchParams();
  const isSignUp = searchParams.get("mode") === "signup";
  const callbackError = searchParams.get("error");

  useEffect(() => {
    if (callbackError) {
      toast.error("Authentication failed. Please try again.");
    }
  }, [callbackError]);

  return (
    <>
      {isSignUp ? (
        <AuthHeader
          title="Create"
          accent="account"
          subtitle="Start tracking your progress"
        />
      ) : (
        <AuthHeader
          title="Welcome"
          accent="back!"
          subtitle="Sign in to continue"
        />
      )}

      {isSignUp ? <SignUpForm /> : <SignInForm />}
    </>
  );
}

function SignInForm() {
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
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="space-y-1.5 md:space-y-2">
          <PasswordInput
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="pr-2 text-[13px] font-medium text-[#c6f432] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton disabled={pending} />

      <p className="mt-4 text-center text-sm text-white/55 md:mt-6 md:text-[15px]">
        Don&apos;t have an account?{" "}
        <Link
          href="/login?mode=signup"
          className="font-semibold text-[#c6f432] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}

function SignUpForm() {
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
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordInput
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <SubmitButton pending={pending}>Sign up</SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton disabled={pending} />

      <p className="mt-4 text-center text-sm text-white/55 md:mt-6 md:text-[15px]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#c6f432] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-4 text-sm text-white/45 md:my-6">
      <span className="h-px flex-1 bg-white/10" />
      or
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
