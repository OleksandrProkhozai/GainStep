import type { Metadata, Viewport } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password · GainStep" };

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0e0f11",
};

// Захищена сторінка: без сесії proxy редіректить на /login.
export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
