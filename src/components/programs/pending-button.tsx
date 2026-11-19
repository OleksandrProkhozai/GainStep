"use client";

import type { VariantProps } from "class-variance-authority";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Кнопка submit для <form action={serverAction}> зі спінером під час виконання. */
export function PendingButton({
  className,
  children,
  variant,
  size,
  "aria-label": ariaLabel,
}: VariantProps<typeof buttonVariants> & {
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      className={cn(className, pending && "opacity-70")}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
