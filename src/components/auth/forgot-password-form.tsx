"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { requestPasswordReset } from "@/lib/auth/actions";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/validations/auth";
import { AuthHeader } from "./auth-shell";
import { IconInput } from "./form-fields";
import { SubmitButton } from "./submit-button";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
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
      if ("error" in result) toast.error(errorText(result.error));
      else setSentTo(values.email);
    }),
  );

  return (
    <>
      {sentTo ? (
        <div role="status">
          <MailCheck className="mb-6 size-10 text-[#c6f432]" aria-hidden />
          <AuthHeader
            title={t("forgot.sentTitle")}
            accent={t("forgot.sentAccent")}
            subtitle={t.rich("forgot.sent", {
              email: () => <span className="font-medium text-white">{sentTo}</span>,
            })}
          />
        </div>
      ) : (
        <>
          <AuthHeader
            title={t("forgot.title")}
            accent={t("forgot.accent")}
            subtitle={t("forgot.subtitle")}
          />
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <IconInput
              icon={Mail}
              label={t("email")}
              type="email"
              autoComplete="email"
              error={errorText(errors.email?.message)}
              {...register("email")}
            />
            <SubmitButton pending={pending}>{t("forgot.submit")}</SubmitButton>
          </form>
        </>
      )}

      <Link
        href="/login"
        className="mt-7 inline-flex items-center gap-2 text-[15px] text-white/55 hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToSignIn")}
      </Link>
    </>
  );
}
