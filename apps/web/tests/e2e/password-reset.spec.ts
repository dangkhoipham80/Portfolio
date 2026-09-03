import { expect, test, type Page } from "@playwright/test";

/**
 * The way back in, driven for real.
 *
 * The pure parts are unit-tested — the field rules and the token shape check in
 * lib/password-reset.test.ts. What is left is everything those cannot answer:
 * whether the link off the sign-in screen actually reaches this flow, whether
 * the confirmation says a mail was sent (it must not), what a dead link looks
 * like, and whether the success screen tells the truth about the sessions the
 * reset closed.
 *
 * The stub decides what happens from the address or the token it is given — see
 * tests/e2e/stub-api.mjs. It holds no mode state, so these run in any order.
 */

const ADDRESS = "admin@example.com";
const NEW_PASSWORD = "a-brand-new-long-password";

/** Mirrors the token shape stub-api.mjs mints, so the stub accepts it. */
function resetToken({ secondsFromNow = 3600 } = {}) {
  const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;

  return [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({ sub: "1", type: "reset_password", exp }),
    "stub-signature",
  ].join(".");
}

async function askForALink(page: Page, email = ADDRESS) {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a reset link" }).click();
}

async function setANewPassword(page: Page, password: string, confirm = password) {
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("New password again", { exact: true }).fill(confirm);
  await page.getByRole("button", { name: "Set the new password" }).click();
}

test.describe("getting to the reset screen", () => {
  test("the sign-in form offers it beside the password", async ({ page }) => {
    // If this link disappears, the flow is unreachable without typing the URL —
    // and the person who needs it is by definition the one who cannot sign in.
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Reset your password" }),
    ).toBeVisible();
  });

  test("its tap target clears the 44px floor", async ({ page }) => {
    // The obvious placement is the field's `meta` slot, 8px above the input. A
    // target this size there would overlap the top of the password field and
    // swallow taps meant for it, which is why the link has a row of its own.
    await page.goto("/login");
    const box = await page.getByRole("link", { name: "Forgot your password?" }).boundingBox();

    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("tapping the top of the password field still focuses the field", async ({ page }) => {
    // The overlap the row placement exists to avoid, asserted rather than
    // reasoned about.
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto("/login");

    const field = page.getByLabel("Password", { exact: true });
    const box = (await field.boundingBox())!;
    await page.mouse.click(box.x + box.width - 8, box.y + 3);

    await expect(field).toBeFocused();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("it asks search engines to stay out, like the rest of the console", async ({ page }) => {
    const response = await page.goto("/forgot-password");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");

    expect(response?.status()).toBe(200);
    expect(robots).toContain("noindex");
  });

  test("it does not wear the public site's nav", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByRole("link", { name: "Certificates" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  });
});

test.describe("asking for a link", () => {
  test("an empty submit is answered without spending an attempt", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "Email me a reset link" }).click();

    await expect(page.getByText(/enter the account/i)).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  });

  test("a malformed address names the actual defect", async ({ page }) => {
    await askForALink(page, "admin.example.com");

    await expect(page.getByText(/missing an @/)).toBeVisible();
  });

  test("the confirmation does not claim a mail was sent", async ({ page }) => {
    /*
     * The property this whole flow is built around. The API answers the same
     * 200 for a registered address and an unknown one so the form cannot be
     * used to discover which addresses exist — and copy saying "we have emailed
     * you" would hand that back in the one place a person actually reads.
     */
    await askForALink(page);

    await expect(page.getByRole("heading", { name: "Check that inbox" })).toBeVisible();
    await expect(page.getByText(/If there is an account for/)).toBeVisible();
    await expect(page.getByText(/we (have )?sent/i)).toHaveCount(0);
  });

  test("an unknown address is answered identically", async ({ page }) => {
    await askForALink(page, "nobody@example.com");

    await expect(page.getByRole("heading", { name: "Check that inbox" })).toBeVisible();
    await expect(page.getByText(/no such (account|user)/i)).toHaveCount(0);
  });

  test("the confirmation replaces the form", async ({ page }) => {
    // Same idiom as the contact form: no ambiguity about whether it was sent.
    await askForALink(page);

    await expect(page.getByRole("button", { name: "Email me a reset link" })).toHaveCount(0);
  });

  test("a rate-limited request says when to come back", async ({ page }) => {
    await askForALink(page, "stub:429@example.com");

    await expect(page.getByText(/Too many requests/)).toBeVisible();
    // 3600 seconds, rendered as words rather than a raw number.
    await expect(page.getByText(/about 1 hour/)).toBeVisible();
  });

  test("an unreachable API is not reported as a bad address", async ({ page }) => {
    await askForALink(page, "stub:503@example.com");

    await expect(page.getByText(/API is not reachable/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check that inbox" })).toHaveCount(0);
  });

  test("the caller's address is forwarded so the API limits the right person", async ({
    page,
    request,
  }) => {
    // Without the header the API's 5/hour bucket is keyed on this server, so
    // five requests from anywhere would lock the form for everybody.
    await askForALink(page, "forwarded-check@example.com");
    await expect(page.getByRole("heading", { name: "Check that inbox" })).toBeVisible();

    const stub = new URL(page.url());
    const seen = await (
      await request.get(`http://127.0.0.1:${process.env.E2E_STUB_PORT ?? 8142}/__requests`)
    ).json();
    expect(stub.pathname).toBe("/forgot-password");

    const ours = seen.filter(
      (entry: { body?: { email?: string } }) =>
        entry.body?.email === "forwarded-check@example.com",
    );
    expect(ours).not.toHaveLength(0);
    expect(ours.at(-1).forwardedFor).not.toBeNull();
  });
});

test.describe("spending the link", () => {
  test("a link with no token at all is a dead end, not a form", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  });

  test("a truncated token is caught before it costs a round trip", async ({ page }) => {
    // Mail clients cut long links in half. Reporting the API's refusal for this
    // reads as "your account is the problem" rather than "the link is".
    await page.goto("/reset-password?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0");

    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  });

  test("the dead end offers a fresh link", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByRole("link", { name: "Send a new link" }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("a live token gets the form", async ({ page }) => {
    await page.goto(`/reset-password?token=${resetToken()}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Choose a new password" }),
    ).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  });

  test("the token never appears in the page's own links", async ({ page }) => {
    // It is in the URL because it has to be, but nothing should copy it into an
    // href a referrer header or a shoulder could carry further.
    const token = resetToken();
    await page.goto(`/reset-password?token=${token}`);

    const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")),
    );
    expect(hrefs.some((href) => href?.includes(token))).toBe(false);
  });

  test("a short password is refused without spending the link", async ({ page }) => {
    await page.goto(`/reset-password?token=${resetToken()}`);
    await setANewPassword(page, "too-short");

    await expect(page.getByText(/3 characters short/)).toBeVisible();
    // Still the form, not the dead end: nothing was sent, so nothing was spent.
    await expect(page.getByRole("button", { name: "Set the new password" })).toBeVisible();
  });

  test("a mismatch is caught before submitting", async ({ page }) => {
    await page.goto(`/reset-password?token=${resetToken()}`);
    await setANewPassword(page, NEW_PASSWORD, `${NEW_PASSWORD}-typo`);

    await expect(page.getByText("These two do not match.")).toBeVisible();
    await expect(page.getByLabel("New password again", { exact: true })).toBeFocused();
  });

  test("an expired token lands on the same dead end as a missing one", async ({ page }) => {
    // Two dead ends for the same dead end is how a person concludes the site is
    // broken rather than the link.
    await page.goto(`/reset-password?token=${resetToken({ secondsFromNow: -60 })}`);
    await setANewPassword(page, NEW_PASSWORD);

    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Send a new link" })).toBeVisible();
  });

  test("a good password is accepted and says what else happened", async ({ page }) => {
    await page.goto(`/reset-password?token=${resetToken()}`);
    await setANewPassword(page, NEW_PASSWORD);

    await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
    // Not obvious, and the whole point of a reset: every token the account held
    // is revoked, which is what makes this the remedy for a stolen session.
    await expect(page.getByText(/signed out, on every device/)).toBeVisible();
  });

  test("the success screen leads back to sign in", async ({ page }) => {
    await page.goto(`/reset-password?token=${resetToken()}`);
    await setANewPassword(page, NEW_PASSWORD);
    await page.getByRole("link", { name: "Go to sign in" }).click();

    await expect(page).toHaveURL(/\/login$/);
  });

  test("it sets no session of its own", async ({ page, context }) => {
    // The reset revokes every token the account holds, this browser's included,
    // so there is nothing to sign in with. A screen that pretended otherwise
    // would land on /admin and be bounced straight back.
    await page.goto(`/reset-password?token=${resetToken()}`);
    await setANewPassword(page, NEW_PASSWORD);
    await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();

    const session = (await context.cookies()).filter(
      (cookie) => cookie.name === "pf_access" || cookie.name === "pf_refresh",
    );
    expect(session).toHaveLength(0);
  });
});

test.describe("at 375px", () => {
  test.use({ viewport: { width: 375, height: 760 } });

  test("neither screen scrolls sideways", async ({ page }) => {
    for (const path of ["/forgot-password", `/reset-password?token=${resetToken()}`]) {
      await page.goto(path);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
    }
  });

  test("the submit buttons are still full-size targets", async ({ page }) => {
    await page.goto("/forgot-password");
    const box = await page.getByRole("button", { name: "Email me a reset link" }).boundingBox();

    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
