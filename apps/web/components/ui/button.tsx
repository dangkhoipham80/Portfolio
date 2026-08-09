import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * The filled action, in one place.
 *
 * `rounded-[--radius-control] bg-primary px-5 py-2.5 …` was written out
 * identically in app/not-found.tsx and app/error.tsx, and the contact form
 * would have been the third copy. Three sites is how the padding on one of them
 * quietly drifts.
 *
 * Exported as classes as well as a component because two of the call sites are
 * a `next/link` and would otherwise need a polymorphic `as` prop — a lot of
 * type machinery to avoid one `className={buttonClasses()}`.
 */

const VARIANTS = {
  /** The one action a screen is asking for. */
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  /** Secondary actions that should not compete: "send another", "cancel". */
  quiet: "border border-border text-foreground hover:border-primary/40 hover:text-primary",
} as const;

export function buttonClasses(
  variant: keyof typeof VARIANTS = "primary",
  className?: string,
) {
  return cn(
    // inline-flex + gap so a button can carry a status dot or an arrow without
    // each call site re-inventing the alignment.
    // py-3 rather than the py-2.5 the inlined versions used: that came to 40px,
    // just under a comfortable touch target.
    "inline-flex items-center justify-center gap-2 rounded-[--radius-control] px-5 py-3 text-sm font-medium transition-opacity",
    // A disabled submit still has to read as the same control, just inert —
    // and it must not keep the pointer affordance of something clickable.
    "disabled:cursor-not-allowed disabled:opacity-70",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  // `type` defaults to "button": an untyped <button> inside a <form> is a
  // submit button, which is a footgun for anything that is not the submit.
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
