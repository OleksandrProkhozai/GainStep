import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in · GainStep" };

// viewport-fit=cover — щоб env(safe-area-inset-*) працював на iPhone
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0e0f11",
};

export default function LoginPage() {
  return (
    <AuthShell>
      {/* AuthForm читає ?mode= — за Cache Components це має бути в Suspense */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm />
      </Suspense>
    </AuthShell>
  );
}

function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="mb-7 h-4 w-1/3" />
      <Skeleton className="h-12 w-full rounded-full md:h-14" />
      <Skeleton className="h-12 w-full rounded-full md:h-14" />
      <Skeleton className="h-12 w-full rounded-full md:h-14" />
    </div>
  );
}
