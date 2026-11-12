"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "./google-icon";

export function GoogleButton({ disabled }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // При успіху браузер іде на Google, тож pending лишаємо.
    if (error) {
      toast.error(error.message);
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={disabled || pending}
      className="h-12 w-full md:h-14 gap-3 rounded-full border-white/15 bg-transparent text-[15px] font-semibold text-white hover:bg-white/5 hover:text-white active:scale-[0.98] dark:border-white/15 dark:bg-transparent dark:hover:bg-white/5"
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <GoogleIcon className="size-5" />
      )}
      Continue with Google
    </Button>
  );
}
