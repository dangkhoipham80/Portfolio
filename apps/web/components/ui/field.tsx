import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import { eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";

/**
 * A labelled form control.
 *
 * The point of this wrapper is that the accessibility wiring cannot be
 * forgotten at a call site: the label is bound to the control by id, the error
 * gets its own id and is pointed at by `aria-describedby`, and `aria-invalid`
 * is set from the same prop that decides whether an error prints. Written out
 * by hand per field, one of those four is eventually missed, and the failure is
 * invisible unless you are the person using a screen reader.
 *
 * The invalid styling keys off the `aria-invalid` attribute rather than a
 * parallel `isError` class, so the visual state and the announced state cannot
 * disagree.
 */

const controlClasses = cn(
  // min-h-11: py-2.5 around 14px text measures 41px — 3px under the 44px
  // touch-target floor the buttons already meet.
  "min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-card px-3.5 py-2.5 text-sm text-foreground",
  "transition-colors placeholder:text-muted-foreground/60 hover:border-primary/40",
  "aria-[invalid=true]:border-destructive",
  // No `focus:outline-none` here. It was written to "avoid fighting" the
  // :focus-visible rule in globals.css and did the opposite: that rule lives in
  // @layer base and this would be a utility, so the utility wins and every
  // input in the form loses its focus ring. The global rule is the whole focus
  // treatment; a control adds nothing.
);

function FieldShell({
  htmlFor,
  label,
  /** Right-aligned mono note on the label row — a counter, a constraint. */
  meta,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  meta?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {/*
        Label and meta share a baseline row, the same shape the skill list on
        the home page uses for name-plus-level. Consistency here is not
        cosmetic: it teaches that a right-aligned mono value belongs to the
        thing on its left.
      */}
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className={eyebrowClasses}>
          {label}
        </label>
        {meta}
      </div>

      {children}

      {error ? (
        <p id={`${htmlFor}-error`} className="mt-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SharedProps = {
  name: string;
  label: string;
  meta?: ReactNode;
  error?: string;
};

export function TextField({
  name,
  label,
  meta,
  error,
  ...props
}: SharedProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id">) {
  return (
    <FieldShell htmlFor={name} label={label} meta={meta} error={error}>
      <input
        id={name}
        name={name}
        className={controlClasses}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  meta,
  error,
  ...props
}: SharedProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  return (
    <FieldShell htmlFor={name} label={label} meta={meta} error={error}>
      <textarea
        id={name}
        name={name}
        // Vertical resize only: a horizontally resizable textarea can be
        // dragged out past its container and break the column.
        className={cn(controlClasses, "resize-y")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
}
