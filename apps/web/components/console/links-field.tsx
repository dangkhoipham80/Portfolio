"use client";

/*
 * A repeating pair of inputs, and a client component only for "Add another".
 *
 * Everything that matters works without it. Each row is two plain inputs named
 * `<name>_label` and `<name>_url`; the browser posts every one of them, in
 * document order, and `readForm` zips the two lists back together by index.
 * There is no hidden JSON field and nothing serialises on submit, so with
 * scripting off the form still saves every row that was rendered — the button
 * below is the only thing that stops working, and the spare blank rows are
 * there so that even then you can add links without it.
 *
 * The alternative — an array of objects in React state written into a hidden
 * input — is the version that looks simpler and silently posts nothing when the
 * hydration it depends on has not happened.
 */

import { useState } from "react";

import { cn } from "@/lib/cn";
import { parseLinks } from "@/lib/content-schema";

/** Spare rows, so the no-JS path can still add links. */
const SPARE_ROWS = 2;

const inputClasses = cn(
  "min-h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-border bg-card",
  "px-3 py-2 text-sm text-foreground transition-colors",
  "placeholder:text-muted-foreground/60 hover:border-primary/40",
);

export function LinksField({
  name,
  label,
  hint,
  error,
  value,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** The intermediate `Label\tURL` per line form. */
  value: string;
}) {
  const saved = parseLinks(value);
  const [extra, setExtra] = useState(0);
  const rows = [
    ...saved,
    ...Array.from({ length: SPARE_ROWS + extra }, () => ({ label: "", url: "" })),
  ];

  return (
    <fieldset className="min-w-0">
      {/*
        A fieldset and legend, not a label: this control has no single input to
        point at, and a <label> whose `for` matches nothing is worse than none —
        it announces as a label for the first thing after it, which here is one
        half of one row.
      */}
      <legend className="text-sm font-medium text-foreground">{label}</legend>

      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}

      {error ? (
        <p id={`${name}-error`} className="mt-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}

      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row, index) => (
          // Index as key, which is right here rather than the usual mistake:
          // a row *is* its position — that is how the two posted lists line up —
          // and rows are never reordered or removed from the middle.
          <li key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <input
              name={`${name}_label`}
              defaultValue={row.label}
              placeholder="Label"
              aria-label={`Link ${index + 1} label`}
              maxLength={60}
              className={cn(inputClasses, "sm:w-44 sm:shrink-0")}
            />
            <input
              name={`${name}_url`}
              defaultValue={row.url}
              placeholder="https://"
              aria-label={`Link ${index + 1} address`}
              maxLength={500}
              className={inputClasses}
            />
          </li>
        ))}
      </ul>

      {/*
        No delete button per row. Clearing both inputs removes the link —
        `readForm` drops any row where both halves are empty — so a dedicated
        control would be a second way to do the same thing, and the one that
        needs JavaScript.
      */}
      <p className="mt-2 text-xs text-muted-foreground">
        Empty a row to remove that link.
      </p>

      <button
        type="button"
        onClick={() => setExtra((count) => count + 1)}
        className="mt-2 inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        Add another
      </button>
    </fieldset>
  );
}
