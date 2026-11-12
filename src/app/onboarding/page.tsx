import { Suspense } from "react";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Onboarding · GainStep" };

// Заглушка онбордингу — повноцінний зробимо на наступних етапах.
export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Sparkles className="size-12 text-brand" aria-hidden />
      <h1 className="text-4xl font-bold tracking-tight">Онбординг</h1>
      <Suspense fallback={<Skeleton className="h-5 w-56" />}>
        <UserEmail />
      </Suspense>
      <SignOutButton />
    </main>
  );
}

async function UserEmail() {
  const user = await getCurrentUser();
  return (
    <p className="text-muted-foreground">
      Вітаємо, <span className="font-medium text-foreground">{user.email}</span>!
      Тут буде налаштування профілю.
    </p>
  );
}
