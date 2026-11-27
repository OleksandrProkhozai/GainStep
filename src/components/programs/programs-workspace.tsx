import { notFound, redirect } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProgramEditor, getProgramsList } from "@/lib/programs/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ActiveProgramProvider } from "./active-program";
import { ChooseActiveProgram } from "./choose-active-program";
import { ProgramEditor } from "./program-editor";
import { ProgramList } from "./program-list";
import { SectionSwitch } from "./section-switch";

/**
 * Розділ Programs. lg+: зліва список, справа редактор (вибраної або
 * активної програми). Телефон: /programs — лише список, /programs/[id] —
 * лише редактор зі стрілкою назад. Список і редактор ділять оптимістичний
 * стан активної програми (ActiveProgramProvider).
 */
export async function ProgramsWorkspace({
  selectedId,
  offerActivate = false,
}: {
  selectedId: string | null;
  /** Щойно створена програма, що не стала активною (?new=1). */
  offerActivate?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user.onboarded) redirect("/onboarding");
  const [supabase, locale, t] = await Promise.all([createClient(), getLocale(), getTranslations("programs")]);

  const list = await getProgramsList(supabase, user.id, locale);
  const editorId = selectedId ?? list.activeProgramId;
  const editor = editorId
    ? await getProgramEditor(supabase, editorId, list.activeProgramId, locale)
    : null;
  if (selectedId && !editor) notFound();

  return (
    <ActiveProgramProvider activeId={list.activeProgramId}>
      <div className="mx-auto w-full max-w-[1280px] space-y-5">
        <header className={cn("space-y-4", selectedId && "max-lg:hidden")}>
          <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">{t("title")}</h1>
          <SectionSwitch active="programs" />
        </header>

        <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
          <aside aria-label={t("title")} className={cn(selectedId && "max-lg:hidden")}>
            <ProgramList data={list} selectedId={editor?.program.id ?? null} />
          </aside>
          <div className={cn("w-full min-w-0 lg:max-w-[880px]", !selectedId && "max-lg:hidden")}>
            {editor ? (
              // Без рамки-картки: редактор лежить просто на фоні сторінки.
              // key — новий редактор (і чистий стан) для кожної програми.
              <ProgramEditor key={editor.program.id} data={editor} offerActivate={offerActivate} />
            ) : list.mine.length > 0 ? (
              // Активної немає (наприклад, видалили) — шаблон не підставляємо.
              <ChooseActiveProgram programs={list.mine} showManage={false} />
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-foreground/15 px-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <LayoutGrid className="size-7" aria-hidden />
                </span>
                <p className="mt-4 font-heading text-xl font-bold">{t("emptyEditor.title")}</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {t("emptyEditor.text")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ActiveProgramProvider>
  );
}
