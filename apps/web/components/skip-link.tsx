/**
 * First tab stop on every page, in both the public site and the console.
 *
 * Without it a keyboard user walks the whole header before reaching anything —
 * on the home page the contact form's submit button was tab stop 23.
 *
 * Lives here rather than in the root layout because the two route groups own
 * their own `<main>`: the site's is wrapped in nav and footer, the console's is
 * not, and a skip link in the root layout would sit outside both and point at
 * an id that belongs to whichever group happened to render.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:border focus:border-border focus:bg-card focus:px-4 focus:py-3 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.18em] focus:text-foreground"
    >
      Skip to content
    </a>
  );
}
