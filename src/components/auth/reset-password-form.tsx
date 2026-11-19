"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { updatePassword } from "@/lib/auth/actions";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/validations/auth";
import { AuthHeader } from "./auth-shell";
import { PasswordInput } from "./form-fields";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result && "error" in result) toast.error(errorText(result.error));
    }),
  );

  return (
    <>
      <AuthHeader
        title={t("reset.title")}
        accent={t("reset.accent")}
        subtitle={t("reset.subtitle")}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <PasswordInput
          label={t("newPassword")}
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
        <SubmitButton pending={pending}>{t("reset.submit")}</SubmitButton>
      </form>
    </>
  );
}
