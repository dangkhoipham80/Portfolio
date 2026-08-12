import { expect, test } from "@playwright/test";

/**
 * A 404 keeps the site's chrome.
 *
 * Worth pinning because the way it works is not obvious. An unmatched URL
 * belongs to no route group, so Next falls back to `app/not-found.tsx` in the
 * root layout — which has no nav and no footer. A catch-all inside `(site)`
 * pulls those URLs into the group so the 404 composes through
 * `(site)/layout.tsx` instead.
 *
 * The obvious-looking fix, a second `not-found.tsx` at the root of the group,
 * makes it worse: Next treats that as the app-root boundary and renders it with
 * only the root layout, which took the chrome off the 404 that already had it.
 * Nothing in the type system or the build output says so — only this does.
 */
const PATHS = [
  // Matches no route at all.
  "/some-stale-link",
  "/deep/stale/link",
  // Matches /projects/[slug], which calls notFound() for an unknown slug.
  "/projects/stub-missing",
];

for (const path of PATHS) {
  test(`${path} returns a 404 that still has the nav and the footer`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nothing is listening on this path",
    );
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Elsewhere" })).toBeVisible();

    // The way onwards. An empty screen with no exit is the thing this avoids.
    await expect(page.getByRole("link", { name: "Back to the portfolio" })).toBeVisible();
  });
}

test("the catch-all does not shadow a real page", async ({ page }) => {
  // A catch-all is the least specific route Next has, but this is the
  // assertion that makes that claim checkable rather than hopeful.
  for (const path of ["/", "/career-journey", "/certificates", "/login"]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} must not fall through to the catch-all`).toBe(200);
  }
});
