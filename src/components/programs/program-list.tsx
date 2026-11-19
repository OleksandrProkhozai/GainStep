import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cloneTemplate } from "@/lib/programs/actions";
import type { ProgramCard, ProgramsList } from "@/lib/programs/queries";
import { cn } from "@/lib/utils";
import { NewProgramButton } from "./name-dialog";
import { PendingButton } from "./pending-button";
import { ProgramThumb } from "./program-thumb";
import { LevelBadge, useScheduleText } from "./template-info";

function ActiveBadge() {
  const t = useTranslations("programs.list");
  return (
    <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
      {t("active")}
    </span>
  );
}

/**
 * Список програм. На телефоні активна програма — велика картка зверху з
 * чипами днів і кнопкою «Open»; на lg+ усі власні програми — однакові
 * картки, вибрана підсвічується.
 */
export function ProgramList({ data, selectedId }: { data: ProgramsList; selectedId: string | null }) {
  const t = useTranslations("programs.list");
  const meta = (p: ProgramCard) => t("meta", { days: p.days.length, exercises: p.exerciseCount });
  const schedule = useScheduleText();
  const active = data.mine.find((p) => p.isActive) ?? null;
  const others = data.mine.filter((p) => !p.isActive);

  return (
    <div className="space-y-6">
      {/* Телефон: велика картка активної програми */}
      {active && (
        <section aria-label={t("activeProgram")} className="lg:hidden">
          <div className="rounded-2xl border border-primary/70 bg-card p-4 shadow-[0_0_0_1px_rgb(198_244_50/0.15)]">
            <div className="flex items-center gap-3">
              <ProgramThumb program={active} size="lg" active />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-heading text-xl font-extrabold">{active.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{meta(active)}</p>
              </div>
              <ActiveBadge />
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
            {data.mine.map((p) => {
              const selected = p.id === selectedId;
              return (
                <li key={p.id} className={cn(p.isActive && "max-lg:hidden")}>
                  <Link
                    href={`/programs/${p.id}`}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-card p-4 transition focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
                      selected ? "border-primary/80 shadow-[0_0_0_1px_rgb(198_244_50/0.2)]" : "border-foreground/10 hover:border-foreground/20",
                    )}
                  >
                    <ProgramThumb program={p} size="md" active={p.isActive} className="max-sm:size-12" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{p.name}</span>
                        {p.isActive && <ActiveBadge />}
                      </span>
                      <span className="block text-sm text-muted-foreground">{meta(p)}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
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
                  <span className="block truncate text-base leading-snug font-semibold">{tpl.name}</span>
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
