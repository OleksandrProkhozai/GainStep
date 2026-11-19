import { z } from "@/lib/validations/zod-codes";

const email = z
  .string()
  .trim()
  .min(1, { error: "emailRequired" })
  .pipe(z.email({ error: "emailInvalid" }));

const password = z
  .string()
  .min(8, { error: "passwordMin" })
  .max(72, { error: "passwordMax" });

export const signInSchema = z.object({
  email,
  password,
});

export const signUpSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "passwordsMismatch",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "passwordsMismatch",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
