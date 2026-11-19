"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FilterOption } from "@/lib/history/queries";
import { historyHref, QUERY_MAX, type HistoryQuery } from "@/lib/history/url";
import { exerciseName, matchesExerciseQuery } from "@/lib/i18n/names";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const ALL = "__all__";

const chip =
  "inline-flex h-10 max-w-full shrink-0 items-center gap-2 rounded-full border border-foreground/10 bg-card px-4 text-sm font-medium transition hover:bg-foreground/4 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none data-[active=true]:border-primary/40 data-[active=true]:text-accent-text";

/** Фільтри історії: програма, вправа (з пошуком), текстовий пошук. Стан — у URL. */
export function HistoryFilters({
  query,
  programs,
  exercises,
}: {
  query: HistoryQuery;
  programs: FilterOption[];
  exercises: FilterOption[];
}) {
  const t = useTranslations("history.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = (patch: Partial<HistoryQuery>) =>
    startTransition(() => {
      router.replace(historyHref({ ...query, ...patch }), { scroll: false });
    });

  const program = programs.find((p) => p.id === query.program);

  return (
    <div role="group" aria-label={t("label")} aria-busy={pending} className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className={chip} data-active={Boolean(program)}>
          <span className="sr-only">{t("program")}: </span>
          <span className="truncate">{program?.name ?? t("allPrograms")}</span>
          <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuRadioGroup
            value={query.program ?? ALL}
            onValueChange={(v) => navigate({ program: v === ALL ? null : v })}
          >
            <DropdownMenuRadioItem value={ALL}>{t("allPrograms")}</DropdownMenuRadioItem>
            {programs.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id}>
                {p.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExerciseFilter value={query.exercise} exercises={exercises} onChange={(id) => navigate({ exercise: id })} />

      <SearchInput initial={query.q ?? ""} onSearch={(q) => navigate({ q: q || null })} />
    </div>
  );
}

function ExerciseFilter({
  value,
  exercises,
  onChange,
}: {
  value: string | null;
  exercises: FilterOption[];
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations("history.filters");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () =>
      [...exercises].sort((a, b) => exerciseName(a, locale).localeCompare(exerciseName(b, locale), locale)),
    [exercises, locale],
  );
  const visible = sorted.filter((e) => matchesExerciseQuery(e, search));
  const current = exercises.find((e) => e.id === value);

  const pick = (id: string | null) => {
    setOpen(false);
    setSearch("");
    onChange(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={chip} data-active={Boolean(current)}>
        <span className="sr-only">{t("exercise")}: </span>
        <span className="max-w-[12rem] truncate">{current ? exerciseName(current, locale) : t("allExercises")}</span>
        <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <label className="flex h-10 items-center gap-2 rounded-full border border-foreground/10 px-3 focus-within:ring-3 focus-within:ring-primary/40">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("searchExercises")}</span>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchExercises")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <ul className="mt-2 max-h-72 overflow-y-auto">
          {!search && (
            <li>
              <OptionButton selected={!value} onClick={() => pick(null)}>
                {t("allExercises")}
              </OptionButton>
            </li>
          )}
          {visible.map((e) => (
            <li key={e.id}>
              <OptionButton selected={e.id === value} onClick={() => pick(e.id)}>
                {exerciseName(e, locale)}
              </OptionButton>
            </li>
          ))}
          {visible.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{t("noExercises")}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-foreground/5 focus-visible:bg-foreground/6 focus-visible:outline-none"
    >
      <span className="flex-1">{children}</span>
      {selected && <Check className="size-4 text-accent-text" aria-hidden />}
    </button>
  );
}

/** Поле пошуку з debounce 300 мс. */
function SearchInput({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const t = useTranslations("history.filters");
  const [value, setValue] = useState(initial);
  // Зміна q ззовні ("Скинути фільтри") — оновлюємо поле без ремаунту (фокус лишається).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    if (initial.trim() !== value.trim()) setValue(initial);
  }
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    const q = value.trim();
    if (q === initial.trim()) return;
    const timer = setTimeout(() => onSearchRef.current(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, initial]);

  return (
    <label
      className={cn(
        "flex h-10 min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-foreground/10 bg-card px-4 focus-within:ring-3 focus-within:ring-primary/40",
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("searchLabel")}</span>
      <input
        type="search"
        value={value}
        maxLength={QUERY_MAX}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("search")}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label={t("clearSearch")}
          className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </label>
  );
}
