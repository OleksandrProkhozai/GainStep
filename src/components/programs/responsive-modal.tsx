"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const DESKTOP_QUERY = "(min-width: 1024px)";

/** true на lg+ (той самий брейкпоінт, що й дворядна розкладка). */
export function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(DESKTOP_QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Модальне вікно: Dialog на lg+, нижній лист (Drawer) з ручкою на телефоні.
 * Заголовок і опис обов'язкові для доступності (опис можна сховати — srOnlyDescription).
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  srOnlyDescription = false,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  srOnlyDescription?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn("flex max-h-[85dvh] flex-col gap-0 border border-foreground/10 bg-card p-0 text-foreground sm:max-w-lg", className)}
        >
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="font-heading text-lg font-bold">{title}</DialogTitle>
            <DialogDescription className={cn("mt-1 text-sm text-muted-foreground", srOnlyDescription && "sr-only")}>
              {description}
            </DialogDescription>
          </div>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={className}>
        <div className="px-4 pt-3 pb-2">
          <DrawerTitle className="font-heading text-lg font-bold">{title}</DrawerTitle>
          <DrawerDescription className={cn("mt-0.5 text-sm text-muted-foreground", srOnlyDescription && "sr-only")}>
            {description}
          </DrawerDescription>
        </div>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
