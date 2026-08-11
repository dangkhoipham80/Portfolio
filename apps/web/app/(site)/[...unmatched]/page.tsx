import { notFound } from "next/navigation";

/**
 * Pulls every unmatched URL into the site group, so its 404 has the site's
 * chrome on it.
 *
 * Without this, `/anything-stale` is matched by no route at all and Next falls
 * back to `app/not-found.tsx` in the root layout — which has no nav and no
 * footer. Someone following an out-of-date link landed on a bare graph-paper
 * screen with no way onwards except the browser's Back button.
 *
 * A catch-all is the least specific route Next has, so it cannot shadow
 * anything: `/certificates`, `/projects/[slug]`, `/login` and the
 * `/auth/refresh` handler are all matched ahead of it. The e2e suite covers
 * each of those, which is what makes that claim checkable rather than hopeful.
 */
export default function UnmatchedRoute() {
  notFound();
}
