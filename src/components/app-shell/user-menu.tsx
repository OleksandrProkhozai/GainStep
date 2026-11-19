"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import { Avatar } from "./logo";

/** Коло з ініціалами в мобільній шапці з меню "Sign out". */
export function UserMenu({
  initials,
  name,
  email,
}: {
  initials: string;
  name: string;
  email: string | null;
}) {
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        className="rounded-full focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <Avatar initials={initials} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 rounded-xl border border-foreground/10 p-1.5"
      >
        <DropdownMenuLabel className="px-2 py-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {email && email !== name && (
            <p className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(() => signOut());
          }}
          className="gap-2 px-2 py-2"
        >
          {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
