import { expect, test } from "@playwright/test";

/**
 * The promise this site is built on: the API can be down and the site still
 * works.
 *
 * It replaced a static SPA that could not break, so "the backend is asleep" has
 * to produce an empty section rather than a 500. The CI web job builds with no
 * API for the same reason, but a green build only means nothing threw — it says
 * nothing about what ends up on the page. These tests open the pages.
 *
 * The pages below were prerendered against a closed port by
 * tests/e2e/build-fixture.mjs. The `/projects/[slug]` tests are the stronger
 * half: that route renders per request, so those failures happen live against
 * the stub while the assertion runs.
 */

const PAGES = [
  {
    path: "/",
    heading: "Phạm Đăng Khôi",
    empty: ["No projects published yet.", "No skills published yet."],
  },
  {
    path: "/career-journey",
    heading: "Where I have worked and studied",
    empty: ["No career entries published yet."],
  },
  {
    path: "/certificates",
    heading: "Courses and certifications",
    empty: ["No certificates published yet."],
  },
];

test.describe("pages built with no API behind them", () => {
  for (const { path, heading, empty } of PAGES) {
    test(`${path} answers 200 and says why it is empty`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status(), `${path} must not 5xx because the API is gone`).toBe(200);

      for (const copy of empty) {
        await expect(page.getByText(copy)).toBeVisible();
      }
    });

    test(`${path} still has its heading and structure`, async ({ page }) => {
      await page.goto(path);

      // An empty section is the acceptable outcome; an empty *page* is not.
      // Without this the tests above would pass on a blank document.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.locator("h1")).toHaveCount(1);

      // Named, because the footer's channel list is a second navigation
      // landmark and a bare getByRole("navigation") now matches both. Naming
      // the one meant here is what the assertion always intended anyway.
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Elsewhere" })).toBeVisible();
    });
  }

  test("the home page counts nothing rather than showing a broken count", async ({ page }) => {
    await page.goto("/");

    // The eyebrows interpolate `projects.length`. A fallback that was not an
    // array would render "Projects · undefined" here, if it rendered at all.
    await expect(page.getByText("Projects · 0")).toBeVisible();
    await expect(page.getByText("Skills · 0")).toBeVisible();
  });

  test("the contact form is still usable when the content API is gone", async ({ page }) => {
    await page.goto("/");

    // The section's whole argument is that the mailto works when nothing else
    // does, so it must survive the outage that makes it necessary.
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "dangkhoipham80@gmail.com" }).first(),
    ).toBeVisible();
  });
});

/**
 * `/projects/[slug]` is rendered on demand, so these exercise lib/api.ts at
 * request time. Each slug makes the stub fail in a different way; the correct
 * answer to all of them is the 404 page, because `getProject` returning null is
 * indistinguishable from a project that does not exist — and a visitor can act
 * on neither.
 */
test.describe("a project detail page when the read fails", () => {
  const FAILURES = [
    { slug: "stub-missing", why: "the API says 404" },
    { slug: "stub-500", why: "the API 500s" },
    { slug: "stub-hangup", why: "the connection drops mid-request" },
    { slug: "stub-not-json", why: "the body is not JSON" },
    { slug: "stub-wrong-shape", why: "the body is JSON of the wrong shape" },
  ];

  for (const { slug, why } of FAILURES) {
    test(`404s, not 500s, when ${why}`, async ({ page }) => {
      const response = await page.goto(`/projects/${slug}`);

      expect(response?.status(), `${why} must not surface as a server error`).toBe(404);
    });
  }

  test("renders the project when the read works", async ({ page }) => {
    // The control. Without it every assertion above would still pass on a route
    // that is broken for all inputs.
    const response = await page.goto("/projects/a-real-slug");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stubbed Project");
    await expect(page.getByText("A project served by the e2e stub.")).toBeVisible();
  });
});
