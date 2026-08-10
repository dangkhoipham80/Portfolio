/**
 * A hairline rule that turns into a live wire while a request is in flight.
 *
 * The same dashed stroke and the same `wire-flow` keyframes as the hero
 * topology, which already reads as packets moving along an edge. It separates a
 * form's fields from its submit button and, on submit, shows the request going
 * out — one <svg>, no JavaScript, and it stops under `prefers-reduced-motion`
 * because the global rule in globals.css covers every animation on the site.
 *
 * Extracted from the contact form when the sign-in form became the second
 * caller. The two are the site's only writes, and this is the one thing they
 * both say: the page is talking to a backend the owner also wrote.
 */
export function Wire({ active }: { active: boolean }) {
  return (
    <svg
      // aria-hidden alone. It already removes the element from the
      // accessibility tree, so role="presentation" alongside it does nothing.
      aria-hidden="true"
      className={`h-px w-full ${active ? "text-primary" : "text-border"}`}
    >
      <line
        x1="0"
        y1="0.5"
        x2="100%"
        y2="0.5"
        stroke="currentColor"
        className={active ? "wire-flow" : undefined}
      />
    </svg>
  );
}
