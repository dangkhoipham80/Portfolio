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
    // The writing section is deliberately absent rather than empty here — see
    // the test below. Projects and capabilities still explain themselves, so
    // the page continues to say that it is empty on purpose rather than broken.
    empty: [
      "No entries returned — the write-up queue is still draining.",
      "No capabilities published yet.",
    ],
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
  {
    // Stronger than the three above: /blog reads searchParams, so it renders
    // per request rather than at build time — this failure happens live.
    path: "/blog",
    heading: "Notes from building this",
    empty: ["No posts published yet."],
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
    // array would render "/selected-work · undefined" here, if it rendered at
    // all.
    await expect(page.getByText("/selected-work · 0")).toBeVisible();
    await expect(page.getByText("/capabilities · 0")).toBeVisible();
  });

  test("the home page drops the writing section rather than advertising an empty one", async ({
    page,
  }) => {
    await page.goto("/");

    // With no posts this section used to render "Nothing published yet" into
    // 545px of blank page — a section whose only content was the admission
    // that it had none, on the page that has five seconds to be convincing.
    // Absent is the intended state, so it is asserted rather than left to
    // whichever way the markup happens to fall.
    await expect(page.locator("#writing")).toHaveCount(0);
    await expect(page.getByText("Nothing published yet")).toHaveCount(0);

    // But not hidden: /blog is still reachable and still explains itself, so
    // dropping the preview loses nobody the content.
    await expect(page.getByRole("link", { name: "Blog" })).toBeVisible();
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

/**
 * The same five failures for a post. Worth repeating rather than trusting the
 * project route to stand for both, because this one does something no other
 * page does: it renders API-supplied Markdown into the DOM through
 * `dangerouslySetInnerHTML`. A malformed read must stop at the 404 page, well
 * before anything reaches that renderer.
 */
test.describe("a post page when the read fails", () => {
  const FAILURES = [
    { slug: "stub-missing", why: "the API says 404" },
    { slug: "stub-500", why: "the API 500s" },
    { slug: "stub-hangup", why: "the connection drops mid-request" },
    { slug: "stub-not-json", why: "the body is not JSON" },
    { slug: "stub-wrong-shape", why: "the body is JSON of the wrong shape" },
  ];

  for (const { slug, why } of FAILURES) {
    test(`404s, not 500s, when ${why}`, async ({ page }) => {
      const response = await page.goto(`/blog/${slug}`);

      expect(response?.status(), `${why} must not surface as a server error`).toBe(404);
    });
  }

  test("renders the post, and its Markdown, when the read works", async ({ page }) => {
    const response = await page.goto("/blog/a-real-slug");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stubbed Post");

    // The body arrived as Markdown and left as HTML: this heading and this
    // <code> only exist if the pipeline ran.
    await expect(page.getByRole("heading", { name: "Stubbed heading", level: 2 })).toBeVisible();
    await expect(page.locator(".article-prose code")).toHaveText("code");
  });
});
