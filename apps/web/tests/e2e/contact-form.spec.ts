import { expect, test, type Page } from "@playwright/test";

import { STUB_URL } from "../../playwright.config";

/**
 * The contact form's failure states, driven for real.
 *
 * `validateContact` is unit-tested in lib/contact.test.ts and is not repeated
 * here. What is left is everything a pure function cannot answer: whether the
 * Server Action's verdict reaches the screen, whether a rate-limited visitor is
 * told when to come back, and whether a message that went nowhere is reported
 * as such instead of appearing to have been sent.
 *
 * Which of those happens is decided by the `subject` — see tests/e2e/stub-api.mjs.
 * The stub holds no mode state, so these run in any order and in parallel, and
 * each test tags its subject so it can find its own request in the stub's log
 * without seeing another test's.
 */

const MESSAGE = "I read your notes and would like to talk.";

/**
 * Open the contact section and wait for the page to stop moving.
 *
 * Two things shift the layout just after load: the jump to `#contact`, which
 * moves the submit button about 1200px up the page, and the web fonts swapping
 * in behind it. Playwright waits for a click target to hold still, so a click
 * issued inside that window is retried — and the retry can land *after* the
 * form has already posted, at which point it waits for a button the
 * confirmation has replaced until the test times out.
 *
 * That failure looks exactly like a broken form and is not one, which is worth
 * a helper rather than a comment on one test: with JavaScript enabled hydration
 * happens to absorb the delay, so only the no-JS case failed, and only most of
 * the time.
 */
async function openContactForm(page: Page) {
  await page.goto("/#contact");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function fillForm(page: Page, subject: string) {
  await page.getByLabel("Name", { exact: true }).fill("Ada Lovelace");
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  await page.getByLabel("Message", { exact: true }).fill(MESSAGE);
}

/**
 * Click Send, but not while the button is still moving.
 *
 * Playwright already waits for a click target to hold still. The problem is
 * what it does when the wait is interrupted: submitting navigates, the button
 * detaches, and Playwright treats a detach during an action as retryable — so
 * it looks for "Send message" again on a page where the confirmation has
 * replaced it, and waits there until the test times out. The form worked; the
 * report says it did not.
 *
 * Settling first removes the interruption rather than the symptom. `expect.poll`
 * rather than a fixed pause because the delay is a font swap and a hash scroll,
 * neither of which takes a predictable length of time on CI.
 */
async function submit(page: Page) {
  const button = page.getByRole("button", { name: "Send message" });
  await expect(button).toBeVisible();

  let previous: string | null = null;
  await expect
    .poll(
      async () => {
        const box = JSON.stringify(await button.boundingBox());
        const held = box === previous;
        previous = box;
        return held;
      },
      { timeout: 10_000, message: "the submit button never stopped moving" },
    )
    .toBe(true);

  await button.click();
}

/**
 * A subject no other submission will carry.
 *
 * The stub keeps every request for the life of the run, so a test asserting
 * "exactly one arrived" has to distinguish its own submission from another
 * test's — and from *its own on a retry*, which CI does once before reporting a
 * failure. Without this, a test that failed for an unrelated reason would fail
 * its retry with "expected 1, received 2" and hide the original cause.
 */
function subjectFor(base: string) {
  const { testId, retry, repeatEachIndex } = test.info();

  return `${base} [${testId}#${retry}.${repeatEachIndex}]`;
}

/** What the stub recorded for this test alone. */
async function requestsFor(page: Page, subject: string) {
  const response = await page.request.get(`${STUB_URL}/__requests`);
  const all = (await response.json()) as { body: { subject?: string } }[];

  return all.filter((entry) => entry.body.subject === subject);
}

test.beforeEach(async ({ page }) => {
  await openContactForm(page);
});

test("sends a valid message and confirms it", async ({ page }) => {
  const subject = subjectFor("A real message");

  await fillForm(page, subject);
  await submit(page);

  await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
  // The confirmation replaces the form, so there is no ambiguity about whether
  // anything was sent.
  await expect(page.getByRole("button", { name: "Send message" })).toBeHidden();

  expect(await requestsFor(page, subject)).toHaveLength(1);
});

test("trims what it stores, so the length check and the row agree", async ({ page }) => {
  const subject = subjectFor("Padded values");

  await page.getByLabel("Name", { exact: true }).fill("   Ada Lovelace   ");
  await page.getByLabel("Email", { exact: true }).fill("  ada@example.com  ");
  await page.getByLabel("Subject", { exact: true }).fill(`  ${subject}  `);
  await page.getByLabel("Message", { exact: true }).fill(`  ${MESSAGE}  `);
  await submit(page);

  await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();

  const [sent] = await requestsFor(page, subject);
  expect(sent.body).toMatchObject({
    name: "Ada Lovelace",
    email: "ada@example.com",
    subject,
    message: MESSAGE,
  });
});

test("stops an invalid submission in the browser without troubling the API", async ({ page }) => {
  await submit(page);

  await expect(page.getByText("4 fields need fixing")).toBeVisible();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Write a message before sending.")).toBeVisible();

  // Focus lands on the first thing to fix. Without it the errors are visible to
  // a sighted user and nowhere at all for a keyboard one, whose focus is still
  // on the submit button.
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();

  // A round trip the browser could have saved. Every other test sends a
  // non-empty subject, so anything recorded with an empty one came from here.
  expect(await requestsFor(page, "")).toHaveLength(0);
});

test("says when to come back after a 429", async ({ page }) => {
  await fillForm(page, "stub:429 please");
  await submit(page);

  // 2700 seconds from the stub, rendered as a duration rather than a number of
  // seconds — the exact second is not useful to anyone.
  await expect(page.getByText(/Try again in about 45 minutes/)).toBeVisible();
  await expect(page.getByText(/five messages an hour/)).toBeVisible();
});

test("stays vague when a 429 carries no Retry-After", async ({ page }) => {
  await fillForm(page, "stub:429-bare please");
  await submit(page);

  await expect(page.getByText(/Try again in a little while/)).toBeVisible();
});

test("keeps what was typed when the send is refused", async ({ page }) => {
  const subject = "stub:429 keeps values";

  await fillForm(page, subject);
  await submit(page);

  await expect(page.getByText(/Try again in about 45 minutes/)).toBeVisible();

  // The visitor has to be able to send this somewhere else. Clearing the form
  // under them would mean retyping it.
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(MESSAGE);
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(subject);
});

test("offers the mailto when the form cannot deliver", async ({ page }) => {
  await fillForm(page, "stub:429 offers email");
  await submit(page);

  const mailto = page
    .getByRole("link", { name: "dangkhoipham80@gmail.com" })
    .and(page.locator('[href^="mailto:"]'));

  await expect(mailto.first()).toBeVisible();
});

test.describe("when the message goes nowhere", () => {
  const OUTAGES = [
    { subject: "stub:503 outage", why: "the API returns 5xx" },
    { subject: "stub:hangup outage", why: "the connection drops" },
  ];

  for (const { subject, why } of OUTAGES) {
    test(`says it was not sent when ${why}`, async ({ page }) => {
      await fillForm(page, subject);
      await submit(page);

      // The opposite of lib/api.ts, and deliberately so: a failed read hides
      // itself behind a fallback, a failed write must not. "Your message went
      // nowhere" is the one thing the visitor has to be told.
      await expect(page.getByText(/has not been sent/)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Message sent" })).toBeHidden();

      // And the text is still there to copy into an email.
      await expect(page.getByLabel("Message", { exact: true })).toHaveValue(MESSAGE);
    });
  }
});

test("lands a 422 from the API on the field that caused it", async ({ page }) => {
  // An address the browser regex accepts and email-validator does not. Reported
  // as an outage it would be a lie the visitor cannot act on.
  await fillForm(page, "stub:422 bad domain");
  await submit(page);

  await expect(page.getByText(/domain we cannot deliver to/)).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
});

test("forwards the visitor's address so the API rate-limits the right person", async ({ page }) => {
  const subject = subjectFor("Forwarded header");

  await page.setExtraHTTPHeaders({ "X-Forwarded-For": "203.0.113.7" });
  await openContactForm(page);
  await fillForm(page, subject);
  await submit(page);

  await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();

  // Without this the API sees the Next server's address and every visitor in
  // the world shares one five-message bucket.
  const [sent] = await requestsFor(page, subject);
  expect(sent).toMatchObject({ forwardedFor: expect.stringContaining("203.0.113.7") });
});

test("works without JavaScript", async ({ browser }) => {
  // The form's `action` is the Server Action itself rather than a wrapper, so a
  // native form POST reaches it. This is the reason it is not a route handler,
  // and nothing else in the suite would notice if it regressed.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    await openContactForm(page);
    await fillForm(page, "No JavaScript");
    await submit(page);

    await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
  } finally {
    await context.close();
  }
});
