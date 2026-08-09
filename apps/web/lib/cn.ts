import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes, letting later ones win.
 *
 * Plain string concatenation does not work for utilities: `"p-5" + " p-8"`
 * leaves both in the class list and the winner is whichever CSS rule the
 * generated stylesheet happens to emit last, not the one the caller passed.
 * twMerge resolves conflicts by utility group, so a component's default padding
 * can actually be overridden from a `className` prop.
 *
 * Same helper the Vite app used (portfolio/frontend/src/lib/utils.ts).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
