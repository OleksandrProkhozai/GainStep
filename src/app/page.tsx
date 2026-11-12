import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";

// Заглушка дашборда — повноцінний зробимо на наступних етапах.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Dumbbell className="size-12 rotate-45 text-brand" aria-hidden />
      <h1 className="text-4xl font-bold tracking-tight">Дашборд</h1>
      <Suspense fallback={<Skeleton className="h-5 w-56" />}>
        <Greeting />
      </Suspense>
      <SignOutButton />
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");

  return (
    <p className="text-muted-foreground">
      Ви увійшли як{" "}
      <span className="font-medium text-foreground">
        {user.displayName ?? user.email}
      </span>
    </p>
  );
}
