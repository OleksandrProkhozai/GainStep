"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, NotebookPen, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateWorkoutNotes } from "@/lib/workout/actions";
import { Card, CardTitle, pill } from "./parts";

const MAX_NOTES = 2000;

/** Нотатка тренування з редагуванням на місці. */
export function NotesCard({
  workoutId,
  initialNotes,
  className,
}: {
  workoutId: string;
  initialNotes: string;
  className?: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const editRef = useRef<HTMLButtonElement>(null);
  const editing = draft !== null;

  const cancel = () => {
    setDraft(null);
    requestAnimationFrame(() => editRef.current?.focus());
  };

  const save = () => {
    if (draft === null) return;
    startSaving(async () => {
      const result = await updateWorkoutNotes(workoutId, draft);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNotes(result.notes);
      setDraft(null);
      toast.success("Note saved");
      requestAnimationFrame(() => editRef.current?.focus());
    });
  };

  return (
    <Card className={className} aria-labelledby="notes-heading">
      <div className="flex items-center justify-between gap-3">
        <CardTitle id="notes-heading" icon={<NotebookPen className="size-5 text-foreground/85" aria-hidden />}>
          Notes
        </CardTitle>
        {!editing && notes && (
          <button
            ref={editRef}
            type="button"
            onClick={() => setDraft(notes)}
            aria-label="Edit note"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {editing ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor="summary-notes" className="sr-only">
            Workout note
          </label>
          <textarea
            id="summary-notes"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            }}
            maxLength={MAX_NOTES}
            rows={3}
            autoFocus
            placeholder="How did it feel?"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/20"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {draft.length}/{MAX_NOTES}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className={cn(pill, "h-10 px-4 text-sm hover:bg-white/5 disabled:opacity-40")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={cn(pill, "h-10 bg-primary px-5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60")}
              >
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Save
              </button>
            </div>
          </div>
        </form>
      ) : notes ? (
        <p className="mt-2 text-sm break-words whitespace-pre-line text-foreground/90">{notes}</p>
      ) : (
        <button
          ref={editRef}
          type="button"
          onClick={() => setDraft("")}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden />
          Add a note
        </button>
      )}
    </Card>
  );
}
