import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A bordered line of prose for something the page has to say and the reader
 * cannot act on immediately: a rate limit with a wait attached, a backend that
 * is not answering, an inbox that could not be loaded.
 *
 * A toast was the other option and is worse for exactly these cases — it
 * disappears, and the states worth reading are the ones you cannot fix in the
 * moment.
 *
 * Extracted once the same class string existed in the contact form, the sign-in
 * form and the admin inbox.
 */
/**
 * Tone is carried by a dot and by the panel's own border, never by the text.
 *
 * ## Why not a coloured rule down the left edge
 *
 * Because that is a named AI tell — "thick coloured border on one side of a
 * card" — and this component had one for about an hour before the Impeccable
 * detector said so. It is worth recording that the reasoning behind it was
 * perfectly sound (colour must not touch text, so put it on a rule instead) and
 * the result was still the single most recognisable generated-UI pattern there
 * is. Reasoning your way to a default is still arriving at the default.
 *
 * ## Why a dot
 *
 * Because it is what this site already does. `StatusBadge` encodes project
 * state as a dot rather than four hues, for the same reason: it degrades
 * honestly in greyscale, it survives not being able to separate red from green,
 * and it is never the sole carrier of meaning — the sentence beside it says the
 * same thing in words.
 *
 * `neutral` is the default and renders exactly what every existing call site
 * had: an unaccented panel with no dot at all.
 */
const TONES = {
  neutral: { border: "border-border", dot: null },
  success: { border: "border-live/40", dot: "bg-live" },
  error: { border: "border-destructive/50", dot: "bg-destructive" },
} as const;

export function Notice({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
}) {
  const { border, dot } = TONES[tone];

  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-control)] border bg-card px-4 py-3 text-sm text-foreground",
        border,
        className,
      )}
    >
      {dot ? (
        // `mt-[0.4em]` rather than a flex alignment: the dot should sit on the
        // first line's optical centre, which moves with the font size and not
        // with the box.
        <span aria-hidden="true" className={cn("mt-[0.4em] h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      ) : null}
      <span>{children}</span>
    </p>
  );
}
