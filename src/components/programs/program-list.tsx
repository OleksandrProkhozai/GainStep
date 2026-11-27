"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Lock, MoreHorizontal, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cloneTemplate } from "@/lib/programs/actions";
import type { ProgramCard, ProgramsList } from "@/lib/programs/queries";
import { cn } from "@/lib/utils";
import { useActiveProgram } from "./active-program";
import { ChooseActiveProgram } from "./choose-active-program";
import { NewProgramButton } from "./name-dialog";
import { PendingButton } from "./pending-button";
import { ProgramThumb } from "./program-thumb";
import { LevelBadge, useScheduleText } from "./template-info";

function ActiveBadge({ className }: { className?: string }) {
  const t = useTranslations("programs.list");
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground",
        className,
      )}
    >
      {t("active")}
    </span>
  );
}

/**
 * Список програм. На телефоні активна програма — велика картка зверху з
 * чипами днів і кнопкою «Open»; на lg+ усі власні програми — однакові
 * картки, вибрана підсвічується. Неактивні картки мають «Зробити активною»
 * (md+ — pill-кнопка, телефон — меню «…»); перемикання оптимістичне
 * (ActiveProgramProvider). Шаблони активними не стають — лише «Використати».
 */
export function ProgramList({ data, selectedId }: { data: ProgramsList; selectedId: string | null }) {
  const t = useTranslations("programs.list");
  const meta = (p: ProgramCard) => t("meta", { days: p.days.length, exercises: p.exerciseCount });
  const schedule = useScheduleText();
  const { activeId } = useActiveProgram();
  const active = data.mine.find((p) => p.id === activeId) ?? null;
  const others = data.mine.filter((p) => p.id !== activeId);
  const ordered = active ? [active, ...others] : others;

  return (
    <div className="space-y-6">
      {/* Активної немає (наприклад, видалили), а власні програми є — телефон */}
      {!active && data.mine.length > 0 && (
        <ChooseActiveProgram programs={data.mine} showManage={false} className="lg:hidden" />
      )}

      {/* Телефон: велика картка активної програми */}
      {active && (
        <section aria-label={t("activeProgram")} className="lg:hidden">
          <div className="rounded-2xl border border-primary/70 bg-card p-4 shadow-[0_0_0_1px_rgb(198_244_50/0.15)]">
            <div className="flex items-center gap-3">
              <ProgramThumb program={active} size="lg" active />
              {/* Бейдж над назвою: в одному рядку він стискав би довгу назву */}
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <ActiveBadge className="mb-1" />
                <h2 className="line-clamp-2 font-heading text-xl leading-tight font-extrabold [overflow-wrap:anywhere]">
                  {active.name}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{meta(active)}</p>
              </div>
            </div>
            {active.days.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("days")}>
                {active.days.map((d) => (
                  <li key={d.id} className="rounded-full bg-foreground/8 px-2.5 py-1 text-xs font-medium text-foreground/85">
                    {d.name}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild className="mt-4 w-full text-[15px]">
              <Link href={`/programs/${active.id}`}>
                {t("open")}
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* На телефоні активна вже показана великою карткою; якщо інших немає — секцію ховаємо */}
      <section aria-labelledby="my-programs-heading" className={cn(active && others.length === 0 && "max-lg:hidden")}>
        <h2 id="my-programs-heading" className="mb-3 font-heading text-lg font-bold">
          {t("mine")}
        </h2>
        {data.mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-foreground/15 px-4 py-6 text-center text-sm text-muted-foreground">
            {t("emptyMine")}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {ordered.map((p) => (
              <MyProgramCard
                key={p.id}
                program={p}
                isActive={p.id === activeId}
                selected={p.id === selectedId}
                meta={meta(p)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="templates-heading">
        <h2 id="templates-heading" className="mb-3 flex items-center gap-2 font-heading text-lg font-bold">
          {t("templates")}
          <Lock className="size-4 text-muted-foreground" aria-label={t("readOnly")} />
        </h2>
        <ul className="space-y-2">
          {data.templates.map((tpl) => (
            <li
              key={tpl.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card p-3",
                tpl.id === selectedId ? "border-primary/80" : "border-foreground/10",
              )}
            >
              <Link
                href={`/programs/${tpl.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
              >
                <ProgramThumb program={tpl} size="md" className="max-sm:size-12" />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-base leading-snug font-semibold [overflow-wrap:anywhere]">{tpl.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {schedule(tpl.daysPerWeek, tpl.days.length)}
                  </span>
                  {tpl.level && <LevelBadge level={tpl.level} className="mt-1" />}
                </span>
              </Link>
              <form action={cloneTemplate.bind(null, tpl.id)} className="shrink-0 self-center">
                <PendingButton variant="outline-pill" size="sm" aria-label={t("useTemplateNamed", { name: tpl.name })} className="px-3.5 text-[13px]">
                  {t("useTemplate")}
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <NewProgramButton />
    </div>
  );
}

/**
 * Картка власної програми. Уся картка — посилання на редактор (::after
 * поверх картки), кнопки «Зробити активною» / «…» лежать над ним (z-10).
 * md–lg: pill праворуч; lg+ (вузький список): pill окремим рядком під назвою.
 */
function MyProgramCard({
  program,
  isActive,
  selected,
  meta,
}: {
  program: ProgramCard;
  isActive: boolean;
  selected: boolean;
  meta: string;
}) {
  const t = useTranslations("programs.list");
  const ta = useTranslations("programs.active");
  const { activeId, pending, activate } = useActiveProgram();
  const busy = pending && activeId === program.id;
  const onActivate = () => activate({ id: program.id, name: program.name });

  return (
    <li className={cn(isActive && "max-lg:hidden")}>
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-2xl border bg-card p-4 transition has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-primary/40 lg:flex-wrap",
          selected ? "border-primary/80 shadow-[0_0_0_1px_rgb(198_244_50/0.2)]" : "border-foreground/10 hover:border-foreground/20",
        )}
      >
        <Link
          href={`/programs/${program.id}`}
          aria-current={selected ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 outline-none after:absolute after:inset-0 after:rounded-2xl lg:basis-full"
        >
          <ProgramThumb program={program} size="md" active={isActive} className="max-sm:size-12" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="line-clamp-2 min-w-0 leading-snug font-semibold [overflow-wrap:anywhere]">{program.name}</span>
              {isActive && <ActiveBadge />}
            </span>
            <span className="block text-sm text-muted-foreground">{meta}</span>
          </span>
          {isActive && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
        </Link>

        {!isActive && (
          <>
            <Button
              type="button"
              variant="outline-pill"
              size="xs"
              disabled={pending}
              aria-busy={busy}
              aria-label={ta("makeActiveNamed", { name: program.name })}
              onClick={onActivate}
              className="relative z-10 px-3 max-md:hidden lg:ml-[68px] lg:-mt-1"
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {ta("makeActive")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={ta("cardActions", { name: program.name })}
                disabled={pending}
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                  className: "relative z-10 -my-1 -mr-2 text-muted-foreground md:hidden",
                })}
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MoreHorizontal className="size-5" aria-hidden />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={onActivate}>
                  <Star aria-hidden />
                  {ta("makeActive")}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/programs/${program.id}`}>
                    <ChevronRight aria-hidden />
                    {t("open")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </li>
  );
}
