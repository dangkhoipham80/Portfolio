import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * The filled action, in one place.
 *
 * `rounded-[var(--radius-control)] bg-primary px-5 py-2.5 …` was written out
 * identically in app/not-found.tsx and app/error.tsx, and the contact form
 * would have been the third copy. Three sites is how the padding on one of them
 * quietly drifts.
 *
 * Exported as classes as well as a component because two of the call sites are
 * a `next/link` and would otherwise need a polymorphic `as` prop — a lot of
 * type machinery to avoid one `className={buttonClasses()}`.
 */

const VARIANTS = {
  /**
   * The one action a screen is asking for. The hover glow is the amber
   * "signal" identity doing its job on the single loudest control — nothing
   * else on a screen is allowed to bloom like this.
   */
  primary:
    "bg-primary text-primary-foreground font-semibold hover:shadow-[0_0_28px_hsl(var(--signal)/0.35)] hover:brightness-105",
  /** Secondary actions that should not compete: "send another", "cancel". */
  quiet: "bg-muted text-foreground hover:bg-accent hover:text-primary",
  /**
   * Destructive actions. Outlined rather than filled, and set in
   * --destructive-text rather than --destructive.
   *
   * Both halves matter. A filled red button is the loudest thing on a screen,
   * and these sit in a row of ordinary controls — the weight should come from
   * the confirmation step, not the colour. And --destructive is tuned to be
   * seen as a fill or a border: as *text* it measures 3.76:1 on a card in light
   * mode and 1.88:1 in dark, which is why the palette carries a second red.
   */
  danger:
    "border border-destructive/50 text-destructive-text hover:border-destructive hover:bg-destructive/10",
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
    // `active:scale-[0.98]` is the press: controls compress under the pointer
    // the way a physical switch does, 100ms so it never feels laggy.
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 py-3 text-sm font-medium transition-[opacity,box-shadow,transform,background-color,color,filter] duration-200 active:scale-[0.98]",
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
