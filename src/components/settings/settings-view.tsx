"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useErrorText } from "@/components/i18n/use-error-text";
import { PendingButton } from "@/components/programs/pending-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { applyDefaultRest, deleteAccount, updateProfile } from "@/lib/profile/actions";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";
import { getInitials } from "@/lib/profile/initials";
import {
  displayNameSchema,
  EXPERIENCES,
  formatRest,
  GOALS,
  NAME_LIMITS,
  REST_LIMITS,
  stepRest,
  UNITS,
  type Experience,
  type Goal,
  type ProfilePatch,
} from "@/lib/profile/schema";
import { unitLabel, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { purgeOtherWorkouts } from "@/lib/workout/store";

export interface SettingsInitial {
  displayName: string | null;
  email: string | null;
  experience: Experience | null;
  goal: Goal | null;
  unit: WeightUnit;
  defaultRestSeconds: number;
  /** Поточна мова інтерфейсу (профіль / cookie / Accept-Language). */
  locale: Locale;
}

const NAME_DEBOUNCE = 800;
const REST_DEBOUNCE = 500;
const SAVED_VISIBLE_MS = 2000;


/**
 * Settings: три картки в одну колонку. Без кнопки Save — кожна зміна
 * зберігається одразу (сегменти), з debounce (ім'я 800 мс, таймер 500 мс)
 * або на blur (ім'я). Оптимістичне оновлення з відкатом при помилці.
 */
export function SettingsView({ initial }: { initial: SettingsInitial }) {
  const t = useTranslations("settings");
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[640px] space-y-4">
      <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">{t("title")}</h1>
      <ProfileCard initial={initial} />
      <PreferencesCard initial={initial} />
      <AccountCard email={initial.email} />
      <div className="flex justify-center pt-1 pb-2">
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-destructive transition hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/30 focus-visible:outline-none"
        >
          <Trash2 className="size-4" aria-hidden />
          {t("deleteAccount.link")}
        </button>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

// ───────────── Збереження ─────────────

type SaveStatus = "idle" | "saving" | "saved";

/**
 * Стан збереження картки: "Saving…" → "Saved ✓" (2 с). Після успіху —
 * router.refresh(): layout перечитує профіль (unit, ім'я в шапці, таймер).
 */
function useProfileSaver() {
  const router = useRouter();
  const errorText = useErrorText();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const inFlight = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const save = useCallback(
    async (patch: ProfilePatch, rollback: () => void) => {
      inFlight.current += 1;
      clearTimeout(timer.current);
      setStatus("saving");
      const result = await updateProfile(patch);
      inFlight.current -= 1;
      if (!result.ok) {
        rollback();
        toast.error(errorText(result.error));
        if (inFlight.current === 0) setStatus("idle");
        return false;
      }
      router.refresh();
      if (inFlight.current === 0) {
        setStatus("saved");
        timer.current = setTimeout(() => setStatus("idle"), SAVED_VISIBLE_MS);
      }
      return true;
    },
    [router, errorText],
  );

  return { status, save };
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const t = useTranslations("settings");
  return (
    <span aria-live="polite" className="flex min-h-5 items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t("saving")}
        </>
      )}
      {status === "saved" && (
        <>
          {t("saved")}
          <Check className="size-4 text-accent-text" strokeWidth={2.5} aria-hidden />
        </>
      )}
    </span>
  );
}

// ───────────── Розмітка ─────────────

function SettingsCard({ title, status, children }: { title: string; status?: SaveStatus; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="font-heading text-lg font-bold">
          {title}
        </h2>
        {status && <SaveIndicator status={status} />}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Рядок: на телефоні підпис над контролом, з sm — зліва від нього. */
function Row({ label, labelId, hint, children }: { label: string; labelId: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <span id={labelId} className="text-sm font-medium text-foreground/85">
        {label}
      </span>
      <div className="min-w-0">
        {children}
        {hint}
      </div>
    </div>
  );
}

/** Сегментований контрол-пігулка (radiogroup зі стрілками). */
function Segmented<T extends string>({
  labelId,
  options,
  value,
  onChange,
}: {
  labelId: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((o) => o.value === value);

  const move = (delta: number) => {
    const next = (Math.max(current, 0) + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex w-full gap-1 rounded-full bg-muted p-1">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (current === -1 && i === 0) ? 0 : -1}
            onClick={() => !active && onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              }
            }}
            className={cn(
              "h-10 min-w-0 flex-1 truncate rounded-full px-3 text-sm font-semibold transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ───────────── Profile ─────────────

function ProfileCard({ initial }: { initial: SettingsInitial }) {
  const t = useTranslations("settings.profile");
  const te = useTranslations("common.enums");
  const errorText = useErrorText();
  const { status, save } = useProfileSaver();
  const ids = { name: useId(), email: useId(), experience: useId(), goal: useId() };

  const [name, setName] = useState(initial.displayName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const savedName = useRef((initial.displayName ?? "").trim());
  const nameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [experience, setExperience] = useState(initial.experience);
  const [goal, setGoal] = useState(initial.goal);

  const commitName = (value: string) => {
    clearTimeout(nameTimer.current);
    const parsed = displayNameSchema.safeParse(value);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "invalidValue");
      return;
    }
    setNameError(null);
    if (parsed.data === savedName.current) return;
    const previous = savedName.current;
    savedName.current = parsed.data;
    void save({ displayName: parsed.data }, () => {
      savedName.current = previous;
      setName(previous);
    });
  };

  useEffect(() => () => clearTimeout(nameTimer.current), []);

  const pick = <K extends "experience" | "goal">(key: K, next: NonNullable<SettingsInitial[K]>) => {
    if (key === "experience") {
      const prev = experience;
      setExperience(next as Experience);
      void save({ experience: next as Experience }, () => setExperience(prev));
    } else {
      const prev = goal;
      setGoal(next as Goal);
      void save({ goal: next as Goal }, () => setGoal(prev));
    }
  };

  return (
    <SettingsCard title={t("title")} status={status}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xl font-extrabold text-primary-foreground sm:size-[72px] sm:text-2xl"
        >
          {getInitials(name, initial.email)}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={ids.name} className="sr-only">
            {t("name")}
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => {
              const value = e.target.value;
              setName(value);
              clearTimeout(nameTimer.current);
              nameTimer.current = setTimeout(() => commitName(value), NAME_DEBOUNCE);
            }}
            onBlur={(e) => commitName(e.target.value)}
            maxLength={NAME_LIMITS.max}
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? `${ids.name}-error` : ids.email}
            className="h-12 w-full rounded-full border border-input bg-background/60 px-5 text-[15px] font-semibold outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 aria-invalid:border-destructive"
          />
          {nameError ? (
            <p id={`${ids.name}-error`} role="alert" className="px-5 text-xs font-medium text-destructive">
              {errorText(nameError)}
            </p>
          ) : (
            <p id={ids.email} className="truncate px-5 text-sm text-muted-foreground">
              {initial.email ?? t("noEmail")}
            </p>
          )}
        </div>
      </div>

      <Row label={t("experience")} labelId={ids.experience}>
        <Segmented
          labelId={ids.experience}
          options={EXPERIENCES.map((v) => ({ value: v, label: te(`experience.${v}`) }))}
          value={experience}
          onChange={(v) => pick("experience", v)}
        />
      </Row>
      <Row label={t("goal")} labelId={ids.goal}>
        <Segmented
          labelId={ids.goal}
          options={GOALS.map((v) => ({ value: v, label: te(`goal.${v}`) }))}
          value={goal}
          onChange={(v) => pick("goal", v)}
        />
      </Row>
    </SettingsCard>
  );
}

// ───────────── Preferences ─────────────


function PreferencesCard({ initial }: { initial: SettingsInitial }) {
  const t = useTranslations("settings.preferences");
  const errorText = useErrorText();
  const { status, save } = useProfileSaver();
  const ids = { unit: useId(), rest: useId(), language: useId() };
  const [locale, setLocale] = useState<Locale>(initial.locale);

  const [unit, setUnit] = useState<WeightUnit>(initial.unit);


  const [rest, setRest] = useState(initial.defaultRestSeconds);
  const savedRest = useRef(initial.defaultRestSeconds);
  const restTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(restTimer.current), []);

  const changeUnit = (next: WeightUnit) => {
    const prev = unit;
    setUnit(next);
    void save({ unit: next }, () => setUnit(prev));
  };

  /**
   * Мова: профіль + cookie (в server action) і router.refresh() у saver —
   * сторінка перемальовується новою мовою без перезавантаження вкладки;
   * активне тренування (Zustand, localStorage) не зачіпається.
   */
  const changeLocale = (next: Locale) => {
    const prev = locale;
    setLocale(next);
    void save({ locale: next }, () => setLocale(prev));
  };

  const offerApply = (seconds: number) => {
    toast.success(t("restSet", { time: formatRest(seconds) }), {
      description: t("restSetText"),
      duration: 8000,
      action: {
        label: t("applyAll"),
        onClick: async () => {
          const result = await applyDefaultRest(seconds);
          if (!result.ok) toast.error(errorText(result.error));
          else toast.success(t("applied", { count: result.updated }));
        },
      },
    });
  };

  const changeRest = (direction: 1 | -1) => {
    const next = stepRest(rest, direction);
    if (next === rest) return;
    setRest(next);
    clearTimeout(restTimer.current);
    restTimer.current = setTimeout(async () => {
      if (next === savedRest.current) return;
      const previous = savedRest.current;
      savedRest.current = next;
      const ok = await save({ defaultRestSeconds: next }, () => {
        savedRest.current = previous;
        setRest(previous);
      });
      if (ok) offerApply(next);
    }, REST_DEBOUNCE);
  };

  const stepBtn =
    "flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/8 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-95 disabled:pointer-events-none disabled:opacity-30";

  return (
    <SettingsCard title={t("title")} status={status}>
      <Row label={t("language")} labelId={ids.language}>
        <Segmented
          labelId={ids.language}
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
          value={locale}
          onChange={changeLocale}
        />
      </Row>
      <Row label={t("units")} labelId={ids.unit}>
        <Segmented
          labelId={ids.unit}
          options={UNITS.map((u) => ({ value: u, label: unitLabel(u, locale) }))}
          value={unit}
          onChange={changeUnit}
        />
      </Row>
      <Row
        label={t("rest")}
        labelId={ids.rest}
        hint={<p className="mt-1.5 px-1 text-xs text-muted-foreground">{t("restHint")}</p>}
      >
        <div role="group" aria-labelledby={ids.rest} className="flex w-full items-center gap-1 rounded-full bg-muted p-1 sm:max-w-[220px]">
          <button
            type="button"
            onClick={() => changeRest(-1)}
            disabled={rest <= REST_LIMITS.min}
            aria-label={t("restDecrease")}
            className={stepBtn}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <output aria-live="polite" className="flex-1 text-center text-[15px] font-bold tabular-nums">
            {formatRest(rest)}
          </output>
          <button
            type="button"
            onClick={() => changeRest(1)}
            disabled={rest >= REST_LIMITS.max}
            aria-label={t("restIncrease")}
            className={stepBtn}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </Row>
    </SettingsCard>
  );
}

// ───────────── Account ─────────────

function AccountCard({ email }: { email: string | null }) {
  const t = useTranslations("settings.account");
  const tc = useTranslations("common");
  return (
    <SettingsCard title={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium text-foreground/85">{t("email")}</span>
        <span className="min-w-0 truncate text-sm text-muted-foreground">{email ?? "—"}</span>
      </div>
      <form action={signOut}>
        <PendingButton variant="outline-pill" className="w-full">
          {tc("signOut")}
        </PendingButton>
      </form>
    </SettingsCard>
  );
}

// ───────────── Delete account ─────────────

const CONFIRM_WORD = "DELETE";

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("settings.deleteAccount");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const inputId = useId();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = text.trim() === CONFIRM_WORD;

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) setText("");
    onOpenChange(next);
  };

  const remove = () =>
    startTransition(async () => {
      const result = await deleteAccount();
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      purgeOtherWorkouts(""); // локальні чернетки тренувань цього акаунта
      toast.success(t("deleted"));
      router.replace("/login");
    });

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("text")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t.rich("confirmLabel", { word: CONFIRM_WORD, b: (chunks) => <span className="font-bold">{chunks}</span> })}
          </label>
          <input
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-12 w-full rounded-full border border-input bg-background/60 px-5 text-[15px] font-semibold tracking-wide outline-none focus-visible:border-destructive focus-visible:ring-3 focus-visible:ring-destructive/20"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className={buttonVariants({ variant: "outline-pill" })}>{tc("cancel")}</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || pending}
            aria-busy={pending}
            onClick={remove}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
