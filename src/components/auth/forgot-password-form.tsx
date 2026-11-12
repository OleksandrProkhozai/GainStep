"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/auth/actions";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/validations/auth";
import { AuthHeader } from "./auth-shell";
import { IconInput } from "./form-fields";
import { SubmitButton } from "./submit-button";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if ("error" in result) toast.error(result.error);
      else setSentTo(values.email);
    }),
  );

  return (
    <>
      {sentTo ? (
        <div role="status">
          <MailCheck className="mb-6 size-10 text-[#c6f432]" aria-hidden />
          <AuthHeader
            title="Check your"
            accent="email"
            subtitle={
              <>
                We sent a password reset link to{" "}
                <span className="font-medium text-white">{sentTo}</span>.
              </>
            }
          />
        </div>
      ) : (
        <>
          <AuthHeader
            title="Forgot"
            accent="password?"
            subtitle="Enter your email and we'll send you a reset link"
          />
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <IconInput
              icon={Mail}
              label="Email address"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <SubmitButton pending={pending}>Send reset link</SubmitButton>
          </form>
        </>
      )}

      <Link
        href="/login"
        className="mt-7 inline-flex items-center gap-2 text-[15px] text-white/55 hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to sign in
      </Link>
    </>
  );
}
