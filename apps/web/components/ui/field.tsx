import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

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

/**
 * The label treatment, and why it is no longer an eyebrow.
 *
 * These were `eyebrowClasses` — mono, uppercase, letterspaced — on the argument
 * that a field label *is* a field name. That reads well on one field and badly
 * on fifteen: a form became a column of shouting, every line at identical
 * weight, and uppercase letterspaced text is measurably slower to scan than
 * sentence case. The eyebrow moved up a level to the group headings, where
 * there are four or five per screen and it does what an eyebrow is for.
 *
 * So a label is quiet now, and hierarchy inside the form comes from the bands.
 */
const labelClasses = "text-sm font-medium text-foreground";

function FieldShell({
  htmlFor,
  label,
  /** Right-aligned mono note on the label row — a counter, a constraint. */
  meta,
  hint,
  required,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  meta?: ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    /*
      `h-full` plus the `justify-end` on the control below is what keeps a row
      of two fields aligned. Grid cells stretch to the tallest in their row, so
      a field whose neighbour carries a hint would otherwise sit a line higher
      than it — visible on Timeline, where "Started on" has no hint and "Ended
      on" does, and the two date inputs landed 24px apart. Labels stay at the
      top of the cell, controls sit on a common baseline at the bottom.
    */
    <div className="flex h-full flex-col">
      {/*
        Label and meta share a baseline row, the same shape the skill list on
        the home page uses for name-plus-level. Consistency here is not
        cosmetic: it teaches that a right-aligned mono value belongs to the
        thing on its left.
      */}
      <div className="flex items-baseline justify-between gap-3">
        {/*
          The marker sits *beside* the <label>, not inside it.

          Inside, it becomes part of the label's text, and the label's text is
          how a control is found — by a screen reader user reading it, and by
          `page.getByLabel("Name", { exact: true })`, which is how every field
          in the contact-form suite is located. Twelve e2e tests went red on
          that: `aria-hidden` keeps the asterisk out of the accessible name but
          not out of the label's text content, and nothing in type-check, lint
          or the unit suite has an opinion about either.
        */}
        <span className="flex items-baseline gap-1">
          <label htmlFor={htmlFor} className={labelClasses}>
            {label}
          </label>
          {required ? (
            <span aria-hidden="true" className="text-muted-foreground">
              *
            </span>
          ) : null}
        </span>
        {meta}
      </div>

      {/*
        Under the label, above the control — which is where the type in
        content-schema.ts always said hints go. They had drifted into `meta`,
        the right-aligned slot, which put a full sentence up to 400px from the
        label it explained and, at 375px, squeezed "Cover image" into 74px of a
        320px row. `meta` is for a counter.
      */}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}

      <div className="mt-2 flex flex-1 flex-col justify-end">{children}</div>

      {error ? (
        <p id={`${htmlFor}-error`} className="mt-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Both the hint and the error, in the order they are read.
 *
 * The hint used to be a bare `<span>` passed as `meta`, described by nothing —
 * so a screen reader announced the label and the control and never the sentence
 * explaining what the field was for. Anyone who could see the form got the
 * help; anyone who could not, did not.
 */
function describedBy(name: string, hint?: string, error?: string) {
  const ids = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * `required` does two jobs and both are needed.
 *
 * It marks the label *and* stays on the element. An earlier version of this
 * file took it off the element, reasoning that the browser's validation bubble
 * looks nothing like the errors these forms render — true, but the attribute is
 * not only a validation trigger. It is what tells assistive technology the
 * field is required, which is exactly what the comment on the contact form
 * says it is relying on, and dropping it silently removed that from four live
 * inputs.
 *
 * The bubble is suppressed where it is unwanted by putting `noValidate` on the
 * form, which is what the contact form already did and what the console's
 * entity form now does too. That separates the two concerns properly: the
 * attribute describes the field, the form decides who reports on it.
 */
type SharedProps = {
  name: string;
  label: string;
  meta?: ReactNode;
  hint?: string;
  required?: boolean;
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
  hint,
  required,
  error,
  className,
  ...props
}: SharedProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id">) {
  return (
    <FieldShell
      htmlFor={name}
      label={label}
      meta={meta}
      hint={hint}
      required={required}
      error={error}
    >
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
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
  hint,
  required,
  error,
  options,
  className,
  ...props
}: SharedProps & { options: { value: string; label: string }[] } & Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "name" | "id"
  >) {
  return (
    <FieldShell
      htmlFor={name}
      label={label}
      meta={meta}
      hint={hint}
      required={required}
      error={error}
    >
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
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
 *
 * It sits on a surface, unlike the other controls, because it is the one field
 * with no box of its own: on a form of bordered inputs an unadorned tickbox
 * reads as floating debris between two of them. The border is what makes it a
 * row rather than a stray.
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
    <label
      htmlFor={name}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border",
        "bg-card px-3.5 py-3 transition-colors hover:border-primary/40",
      )}
    >
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        aria-describedby={hint ? `${name}-hint` : undefined}
        // h-5 w-5: the browser default is 13px, which is both hard to hit and
        // visually lost next to 14px text. accent-primary tints the tick with
        // the site's own colour instead of the OS blue.
        // mt-0.5 aligns it to the cap height of the label rather than the box.
        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className={cn(labelClasses, "block")}>{label}</span>
        {hint ? (
          <span
            id={`${name}-hint`}
            className="mt-0.5 block text-xs leading-relaxed text-muted-foreground"
          >
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function TextAreaField({
  name,
  label,
  meta,
  hint,
  required,
  error,
  className,
  ...props
}: SharedProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  return (
    <FieldShell
      htmlFor={name}
      label={label}
      meta={meta}
      hint={hint}
      required={required}
      error={error}
    >
      <textarea
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        {...props}
        // Vertical resize only: a horizontally resizable textarea can be
        // dragged out past its container and break the column.
        //
        // `field-sizing-content` grows the box with what is in it, so a list of
        // six technologies stops rendering as four and a half. It is
        // Chromium-only for now, which is why `rows` stays on the element:
        // where it is unsupported nothing changes, and where it is supported
        // `rows` is ignored and these two bounds take over — the min so an
        // empty field is still a target worth clicking, the max so a long post
        // body does not become a page-length input you cannot scroll past.
        className={cn(controlClasses, "resize-y field-sizing-content min-h-24 max-h-128", className)}
      />
    </FieldShell>
  );
}
