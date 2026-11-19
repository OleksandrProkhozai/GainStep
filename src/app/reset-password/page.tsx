import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.meta");
  return { title: t("reset") };
}

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
