"use client";

import { useId, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/components/i18n/use-error-text";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { createProgram } from "@/lib/programs/actions";
import { programNameSchema } from "@/lib/programs/schema";
import { cn } from "@/lib/utils";
import { ResponsiveModal } from "./responsive-modal";

/**
 * Діалог з одним полем назви (нова програма, перейменування програми чи дня).
 * onSubmit повертає текст помилки або null.
 */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  initialValue,
  schema,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  initialValue: string;
  schema: z.ZodType<string>;
  submitLabel: string;
  onSubmit: (value: string) => Promise<string | null> | string | null;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {open && (
        <NameForm
          label={label}
          initialValue={initialValue}
          schema={schema}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </ResponsiveModal>
  );
}

function NameForm({
  label,
  initialValue,
  schema,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  initialValue: string;
  schema: z.ZodType<string>;
  submitLabel: string;
  onSubmit: (value: string) => Promise<string | null> | string | null;
  onCancel: () => void;
}) {
  const id = useId();
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "invalidValue");
          return;
        }
        startTransition(async () => {
          const err = await onSubmit(parsed.data);
          if (err) setError(err);
        });
      }}
    >
      <div className="px-4 pb-2 lg:px-5">
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="off"
          maxLength={80}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-12 w-full rounded-full border border-line bg-background/70 px-5 text-[15px] outline-none focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20 aria-invalid:border-destructive/70"
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-destructive">
            {errorText(error)}
          </p>
        )}
      </div>
      <div className="flex gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:px-5 lg:pb-5">
        <Button type="button" variant="outline-pill" onClick={onCancel} className="flex-1">
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} className="flex-1">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** «+ New program» — кнопка з діалогом назви; створення → редактор нової програми. */
export function NewProgramButton({ className }: { className?: string }) {
  const t = useTranslations("programs.newProgram");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="lg" onClick={() => setOpen(true)} className={cn("w-full text-[15px]", className)}>
        <Plus aria-hidden />
        {t("new")}
      </Button>
      <NameDialog
        open={open}
        onOpenChange={setOpen}
        title={t("new")}
        description={t("newDescription")}
        label={t("name")}
        initialValue=""
        schema={programNameSchema}
        submitLabel={t("create")}
        onSubmit={async (name) => {
          const result = await createProgram(name);
          return result?.ok === false ? result.error : null;
        }}
      />
    </>
  );
}
