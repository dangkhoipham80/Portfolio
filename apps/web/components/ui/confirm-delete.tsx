import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * A delete that takes two deliberate actions, and no JavaScript to enforce it.
 *
 * The reflex here is `onClick={() => confirm(...)}`, which fails in the wrong
 * direction: with scripting off the handler never runs and the single click
 * deletes immediately — a guard that disappears exactly when it is not being
 * watched. A `<dialog>` has the same problem, since it needs `showModal()` to
 * open at all.
 *
 * `<details>` is the version that works with nothing running. The summary is
 * keyboard-operable and screen-reader-announced natively, the panel is real
 * markup either way, and the destructive control genuinely does not exist on
 * the page until it has been opened. The summary relabels itself to "Cancel"
 * when open, because a control that still says "Delete" while a Delete button
 * sits underneath it is asking to be clicked twice.
 *
 * Consumed by the inbox now; every content list that grows a delete wants the
 * same thing, which is why it is here rather than in that page.
 */
export function ConfirmDelete({
  action,
  id,
  warning,
  confirmLabel = "Delete permanently",
}: {
  /** A Server Action. It receives the `id` below as a form field. */
  action: (formData: FormData) => Promise<void>;
  id: number;
  /** What is about to be lost. Specific — "this message", not "this item". */
  warning: string;
  confirmLabel?: string;
}) {
  return (
    <details className="group/confirm">
      <summary
        className={cn(
          buttonClasses("quiet", "min-h-11 cursor-pointer px-4 py-2 text-xs"),
          // The default triangle is removed in both engines — Blink and modern
          // Safari use ::marker, older WebKit its own pseudo-element.
          "list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="group-open/confirm:hidden">Delete</span>
        <span className="hidden group-open/confirm:inline">Cancel</span>
      </summary>

      <div className="mt-2 rounded-[var(--radius-control)] border border-destructive/40 bg-card p-3">
        <p className="text-sm text-foreground">{warning}</p>

        <form action={action} className="mt-3">
          <input type="hidden" name="id" value={id} />
          <Button variant="danger" type="submit" className="min-h-11 px-4 py-2 text-xs">
            {confirmLabel}
          </Button>
        </form>
      </div>
    </details>
  );
}
