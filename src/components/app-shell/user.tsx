import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { Avatar, getInitials } from "./logo";
import { UserMenu } from "./user-menu";

/** Поточний користувач для каркаса (читає сесію — лише в Suspense). */
async function getShellUser() {
  const user = await getCurrentUser();
  // Proxy робить це оптимістично; тут — авторитетна перевірка.
  if (!user.onboarded) redirect("/onboarding");
  const t = await getTranslations("common");
  const name = user.displayName?.trim() || user.email || t("athlete");
  return { name, email: user.email, initials: getInitials(name) };
}

/** Картка користувача внизу сайдбару: lg+ — повна, md–lg — лише іконки. */
export async function SidebarUser() {
  const [{ name, initials }, t] = await Promise.all([getShellUser(), getTranslations("common")]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl lg:flex-row lg:gap-3 lg:border lg:border-foreground/10 lg:bg-foreground/[0.03] lg:p-3">
      <Avatar initials={initials} />
      <div className="hidden min-w-0 flex-1 lg:block">
        <p className="truncate text-sm font-semibold">{name}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="mt-0.5 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            {t("signOut")}
          </button>
        </form>
      </div>
      {/* md–lg: лише іконка виходу з підказкою */}
      <TooltipProvider>
        <Tooltip>
          <form action={signOut} className="lg:hidden">
            <TooltipTrigger asChild>
              <button
                type="submit"
                aria-label={t("signOut")}
                className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            </TooltipTrigger>
          </form>
          <TooltipContent side="right">{t("signOut")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function SidebarUserSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 lg:flex-row lg:rounded-2xl lg:border lg:border-foreground/10 lg:p-3">
      <Skeleton className="size-9 rounded-full" />
      <div className="hidden flex-1 space-y-1.5 lg:block">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

/** Аватар з меню в мобільній шапці. */
export async function HeaderUser() {
  const user = await getShellUser();
  return <UserMenu {...user} />;
}
