"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Вийти
    </Button>
  );
}
