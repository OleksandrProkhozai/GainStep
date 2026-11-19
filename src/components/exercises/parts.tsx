"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  EQUIPMENT,
  MUSCLE_FILTERS,
  type ExerciseFilter,
} from "@/lib/exercises/catalog";
import { cn } from "@/lib/utils";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
        active ? "bg-primary text-primary-foreground" : "bg-foreground/6 text-foreground/85 hover:bg-foreground/10",
      )}
    >
      {children}
    </button>
  );
}

/** Затримка пошуку, мс. */
const SEARCH_DEBOUNCE = 250;

/**
 * Пошук (pill, з debounce) і чипи фільтрів груп м'язів та обладнання.
 * Контрольований компонент: стан тримає батько (URL або локальний стан).
 */
export function ExerciseFilters({
  filter,
  onChange,
  className,
}: {
  filter: ExerciseFilter;
  onChange: (next: ExerciseFilter) => void;
  className?: string;
}) {
  const t = useTranslations("exercises.filters");
  const te = useTranslations("common.enums.equipment");
  const [text, setText] = useState(filter.q);
  const latest = useRef({ filter, onChange });
  useEffect(() => {
    latest.current = { filter, onChange };
  });

  // Зовнішнє скидання пошуку (наприклад, "Clear filters") — синхронізуємо поле.
  const [syncedQ, setSyncedQ] = useState(filter.q);
  if (filter.q !== syncedQ) {
    setSyncedQ(filter.q);
    setText(filter.q);
  }

  useEffect(() => {
    if (text === latest.current.filter.q) return;
    const t = setTimeout(() => latest.current.onChange({ ...latest.current.filter, q: text }), SEARCH_DEBOUNCE);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className={cn("space-y-3", className)}>
      <label className="relative block">
        <span className="sr-only">{t("search")}</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("search")}
          autoComplete="off"
          className="h-12 w-full rounded-full border border-line bg-background/70 pr-10 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              onChange({ ...filter, q: "" });
            }}
            aria-label={t("clearSearch")}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>

      <div role="group" aria-label={t("muscleGroup")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        <Chip active={filter.muscle === null} onClick={() => onChange({ ...filter, muscle: null })}>
          {t("all")}
        </Chip>
        {MUSCLE_FILTERS.map((m) => (
          <Chip
            key={m.id}
            active={filter.muscle === m.id}
            onClick={() => onChange({ ...filter, muscle: filter.muscle === m.id ? null : m.id })}
          >
            {t(`muscle.${m.id}`)}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label={t("equipment")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {EQUIPMENT.map((e) => (
          <Chip
            key={e}
            active={filter.equipment === e}
            onClick={() => onChange({ ...filter, equipment: filter.equipment === e ? null : e })}
          >
            {te(e)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
