import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-ui";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Get started · GainStep" };

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0e0f11",
};

export default function OnboardingPage() {
  return (
    // Читає сесію — за Cache Components це має бути в Suspense.
    <Suspense fallback={<OnboardingSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const user = await getCurrentUser();
  // Proxy робить це оптимістично; тут — авторитетна перевірка.
  if (user.onboarded) redirect("/");

  const supabase = await createClient();
  const { data: templates, error } = await supabase
    .from("programs")
    .select("id, name, days_per_week")
    .is("owner_id", null)
    .order("days_per_week", { ascending: true })
    .order("name", { ascending: true });
  if (error) console.error("onboarding: load templates", error);

  return <OnboardingWizard templates={templates ?? []} />;
}

function OnboardingSkeleton() {
  return (
    <OnboardingShell step={1} completed={0}>
      {/* Нижче lg: крок 1 */}
      <div className="mt-8 flex flex-1 flex-col md:mt-10 lg:hidden" aria-hidden>
        <Skeleton className="h-9 w-3/4 md:w-80" />
        <Skeleton className="mt-3 mb-6 h-4 w-2/3 md:mb-8 md:w-72" />
        <Skeleton className="h-36 w-full rounded-3xl md:max-w-md" />
        <Skeleton className="mt-4 h-14 w-full rounded-full md:max-w-md" />
        <Skeleton className="mt-auto h-14 w-full rounded-full md:ml-auto md:w-44" />
      </div>
      {/* lg+: один екран */}
      <div className="mt-7 hidden flex-col lg:flex" aria-hidden>
        <div className="grid grid-cols-[minmax(0,1.25fr)_1px_minmax(0,1fr)] gap-10">
          <div>
            <Skeleton className="h-9 w-72" />
            <Skeleton className="mt-2 h-4 w-80" />
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Skeleton className="h-[150px] rounded-3xl" />
              <Skeleton className="h-[150px] rounded-3xl" />
            </div>
          </div>
          <span className="bg-white/10" />
          <div className="space-y-4">
            <Skeleton className="h-[86px] rounded-3xl" />
            <Skeleton className="h-[84px] rounded-3xl" />
            <Skeleton className="h-[84px] rounded-3xl" />
          </div>
        </div>
        <Skeleton className="mt-6 h-6 w-64" />
        <div className="mt-2 grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[110px] rounded-3xl" />
          ))}
        </div>
        <Skeleton className="mt-6 ml-auto h-14 w-44 rounded-full" />
      </div>
    </OnboardingShell>
  );
}
