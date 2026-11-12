import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, { error: "Email is required" })
  .pipe(z.email({ error: "Enter a valid email address" }));

const password = z
  .string()
  .min(8, { error: "Password must be at least 8 characters" })
  .max(72, { error: "Password must be at most 72 characters" });

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
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
