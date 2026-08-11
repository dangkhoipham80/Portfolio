import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

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

/*
 * Every control below pulls `className` out of the rest of its props and merges
 * it, rather than letting the spread carry it.
 *
 * Spreading it is the bug it looks like it is not. `<input className={base}
 * {...props} />` lets a caller's `className` replace the base outright — and
 * because a spread applies whatever the key holds, passing `className={
 * undefined}` from a conditional replaces it with nothing at all. The controls
 * then render with no border, no background and no padding, which on a light
 * page means an input you cannot see. That shipped through type-check and lint
 * and was caught by opening the form.
 */

export function TextField({
  name,
  label,
  meta,
  error,
  className,
  ...props
}: SharedProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id">) {
  return (
    <FieldShell htmlFor={name} label={label} meta={meta} error={error}>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
        className={cn(controlClasses, className)}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  meta,
  error,
  options,
  className,
  ...props
}: SharedProps & { options: { value: string; label: string }[] } & Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "name" | "id"
  >) {
  return (
    <FieldShell htmlFor={name} label={label} meta={meta} error={error}>
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
        className={cn(controlClasses, className)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/**
 * A checkbox, which does not use FieldShell.
 *
 * The shell puts its label above the control, which is right for something you
 * type into and wrong for a checkbox — a tickbox belongs beside its label, and
 * the label has to be part of the target rather than sitting above it. So this
 * is a `<label>` wrapping both, giving a 44px row that is entirely clickable.
 */
export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="inline-flex min-h-11 cursor-pointer items-center gap-3"
      >
        <input
          id={name}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          // h-5 w-5: the browser default is 13px, which is both hard to hit and
          // visually lost next to 14px text. accent-primary tints the tick with
          // the site's own colour instead of the OS blue.
          className="h-5 w-5 shrink-0 accent-primary"
        />
        <span className={eyebrowClasses}>{label}</span>
      </label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  meta,
  error,
  className,
  ...props
}: SharedProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  return (
    <FieldShell htmlFor={name} label={label} meta={meta} error={error}>
      <textarea
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
        // Vertical resize only: a horizontally resizable textarea can be
        // dragged out past its container and break the column.
        className={cn(controlClasses, "resize-y", className)}
      />
    </FieldShell>
  );
}
