"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type IconInputProps = React.ComponentProps<"input"> & {
  icon: LucideIcon;
  label: string;
  error?: string;
  endAdornment?: React.ReactNode;
};

/** Поле з іконкою ліворуч, прихованою підписом-лейблом і помилкою під ним. */
export function IconInput({
  icon: Icon,
  label,
  error,
  endAdornment,
  className,
  id,
  ...props
}: IconInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-white/50"
        />
        <Input
          id={inputId}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 rounded-full md:h-14 border-white/10 bg-[#0e0f11]/60 pl-13 text-base text-white placeholder:text-white/45 focus-visible:border-[#c6f432] focus-visible:ring-[#c6f432]/20 md:text-[15px] dark:bg-[#0e0f11]/60",
            endAdornment ? "pr-14" : "pr-5",
            className,
          )}
          {...props}
        />
        {endAdornment && (
          <div className="absolute top-1/2 right-2 -translate-y-1/2">
            {endAdornment}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="pl-13 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

type PasswordInputProps = Omit<
  React.ComponentProps<"input">,
  "type"
> & {
  label?: string;
  error?: string;
};

/** Поле пароля з кнопкою показати/сховати. */
export function PasswordInput({
  label = "Password",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <IconInput
      icon={Lock}
      label={label}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex size-10 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-[#c6f432]/40 focus-visible:outline-none"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
      {...props}
    />
  );
}
