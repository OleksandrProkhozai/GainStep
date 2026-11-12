"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updatePassword } from "@/lib/auth/actions";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/validations/auth";
import { AuthHeader } from "./auth-shell";
import { PasswordInput } from "./form-fields";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm() {
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
      if (result && "error" in result) toast.error(result.error);
    }),
  );

  return (
    <>
      <AuthHeader
        title="Set new"
        accent="password"
        subtitle="Choose a password with at least 8 characters"
      />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <PasswordInput
          label="New password"
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
        <SubmitButton pending={pending}>Update password</SubmitButton>
      </form>
    </>
  );
}
