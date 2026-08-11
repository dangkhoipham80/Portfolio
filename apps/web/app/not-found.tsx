import { NotFoundContent } from "@/components/not-found-content";

/**
 * The 404 for the whole app.
 *
 * There is deliberately no second copy inside `(site)`. A `not-found.tsx` at
 * the root of a route group is treated as the app-root boundary and renders
 * with only the root layout, so adding one there took the nav and footer *off*
 * the 404 that previously had them. This single boundary, reached from a
 * segment inside `(site)` — an unpublished project slug, or the catch-all
 * beside it — composes down through `(site)/layout.tsx` and keeps the chrome.
 */
export default function NotFound() {
  return <NotFoundContent />;
}
