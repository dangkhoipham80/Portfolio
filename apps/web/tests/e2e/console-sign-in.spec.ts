import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { BASE_URL } from "../../playwright.config";

/**
 * The console's session, driven for real.
 *
 * The pure parts are unit-tested — safeNextPath and the cookie descriptors in
 * lib/session.test.ts, the response mapping in lib/console-api.test.ts. What is
 * left is everything those cannot answer: whether a signed-out visitor is
 * actually turned away, whether the token really is out of the browser's reach,
 * whether an expired session renews itself without anyone noticing, and whether
 * signing out closes the door again.
 *
 * The stub decides what happens from the credentials it is given — see
 * tests/e2e/stub-api.mjs. It holds no mode state, so these run in any order.
 */

const PASSWORD = "correct-horse-battery-staple";
const ADMIN = "admin@example.com";

async function signIn(page: Page, email = ADMIN, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** The names lib/session.ts uses. Asserted rather than assumed. */
async function sessionCookies(context: BrowserContext) {
  const all = await context.cookies();
  return all.filter((cookie) => cookie.name === "pf_access" || cookie.name === "pf_refresh");
}

test.describe("the way in", () => {
  test("the header offers the console", async ({ page }) => {
    await page.goto("/");
    await page.locator('header a[href="/login"]').click();

    await expect(page).toHaveURL(/\/login$/);
    // "Sign in", not "Console access": the screen serves readers now as well as
    // the owner, and one of the two audiences is much the larger.
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("on a phone it moves to the footer, and is still there", async ({ page }) => {
    // The header runs out of room at 375px — six 44px targets plus the name do
    // not fit — so the control is dropped from the row and the footer link is
    // the way in. If both ever disappear at once, the console is unreachable
    // without typing the URL.
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto("/");

    await expect(page.locator('header a[href="/login"]')).toBeHidden();
    await expect(page.locator('footer a[href="/login"]')).toBeVisible();
  });

  test("the footer link works", async ({ page }) => {
    await page.goto("/");
    await page.locator('footer a[href="/login"]').click();

    await expect(page).toHaveURL(/\/login$/);
  });

  test("a live session skips the form entirely", async ({ page }) => {
    // What lets the header control be a plain static link: it always points at
    // /login, and /login decides. Without this the owner would meet a sign-in
    // form while already signed in.
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("signed out", () => {
  test("the admin area is closed, and remembers where you were going", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("the login screen does not wear the public site's nav", async ({ page }) => {
    // The reason the app was split into route groups. A header offering
    // Projects / Career / Certificates above a password field reads as a
    // different product bolted on.
    await page.goto("/login");

    await expect(page.getByRole("link", { name: "Certificates" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to the site" })).toBeVisible();
  });

  test("it asks search engines to stay out", async ({ page }) => {
    const response = await page.goto("/login");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");

    expect(response?.status()).toBe(200);
    expect(robots).toContain("noindex");
  });
});

test.describe("signing in", () => {
  test("a wrong password is refused, and sets no session", async ({ page, context }) => {
    await signIn(page, ADMIN, "not-the-password");

    await expect(page.getByText(/that email and password don.t match/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionCookies(context)).toHaveLength(0);
  });

  test("the wording does not say which half was wrong", async ({ page }) => {
    // The API answers unknown-address and wrong-password with the same 401 so
    // the screen cannot be used to enumerate accounts. Undoing that in the copy
    // would hand the property straight back.
    await signIn(page, "nobody@example.com", "not-the-password");

    const status = page.getByText(/that email and password don.t match/);
    await expect(status).toBeVisible();
    await expect(page.getByText(/no such (account|user)/i)).toHaveCount(0);
  });

  test("tabbing past an untouched field does not invent an error", async ({ page }) => {
    // The blur handler cleared its field by spreading `{ ...prev, email:
    // undefined }`, which keeps the key — so Object.keys().length counted it and
    // the live region announced "1 field needs filling in" after a single Tab
    // off the autofocused field, with no field marked invalid to match.
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).focus();
    await page.keyboard.press("Tab");

    await expect(page.getByText(/field.? need/)).toHaveCount(0);
    await expect(page.getByText("POST /auth/login · 10 per 15 min")).toBeVisible();
  });

  test("an empty submit is answered without spending an attempt", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("2 fields need filling in")).toBeVisible();
    // Focus lands on the first field that needs fixing.
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  });

  test("the right password opens the inbox", async ({ page }) => {
    await signIn(page);

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Contact messages" })).toBeVisible();
    await expect(page.getByText("Stubbed message 1")).toBeVisible();
    // One of the two stub messages is already read.
    await expect(page.getByText("2 messages · 1 unread")).toBeVisible();
  });

  test("the token never reaches the browser", async ({ page, context }) => {
    // The single property the whole cookie approach exists for. If this fails,
    // any injected script on the site can lift a credential that authorises
    // every write route on the API.
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);

    const cookies = await sessionCookies(context);
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
    }

    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain("pf_access");
    expect(visible).not.toContain("pf_refresh");
  });

  test("it returns you to the page that bounced you", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);

    await page.getByLabel("Email", { exact: true }).fill(ADMIN);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin$/);
  });

  test("a rate-limited attempt says when to come back", async ({ page }) => {
    await signIn(page, "stub:429@example.com", PASSWORD);

    await expect(page.getByText(/Too many attempts/)).toBeVisible();
    // 900 seconds, rendered as words rather than a raw number.
    await expect(page.getByText(/about 15 minutes/)).toBeVisible();
  });

  test("an unreachable API is not reported as a bad password", async ({ page }) => {
    await signIn(page, "stub:503@example.com", PASSWORD);

    await expect(page.getByText(/API is not reachable/)).toBeVisible();
    await expect(page.getByText(/that email and password don.t match/)).toHaveCount(0);
  });

  test("an account without the admin role is signed in, and not into the console", async ({
    page,
    context,
  }) => {
    // The stub hands out a perfectly valid session for this one; it is the role
    // check that decides where it goes, not the credentials.
    await signIn(page, "stub:viewer@example.com", PASSWORD);

    /*
      It used to be bounced back to this form with `?next=%2Fadmin` still on it,
      which was the only thing the app could do when every account was the
      owner's. It reads as a broken sign-in: the password was right, the session
      is live, and the screen asks for it again.

      Readers have accounts now, so a non-admin signing in goes to the site. The
      property this test is actually about is unchanged and is asserted below —
      they are not in the console.
    */
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // The session exists — it is the destination that differs, not the outcome.
    expect(await sessionCookies(context)).not.toHaveLength(0);

    /*
      And the console is still shut to them. They are turned around at the guard
      and put back on the site rather than parked on the sign-in form with
      `?next=%2Fadmin` — asking a live session to sign in again is a loop with
      no exit, and the browser proves it: the first version of this behaved
      exactly that way and died with ERR_TOO_MANY_REDIRECTS. See `landingPath`.
    */
    await page.goto("/admin");
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page).not.toHaveURL(/\/admin/);
  });
});

/**
 * The origin the browser is actually on.
 *
 * Not `baseURL`: Playwright's configured base and the host the page ends up on
 * can differ (127.0.0.1 against localhost), and those are two different hosts
 * as far as cookies are concerned. A cookie added for the wrong one is simply
 * never sent, which turns a test of the renewal path into a test of the
 * signed-out path that passes for the wrong reason.
 */
async function liveOrigin(page: Page): Promise<string> {
  await page.goto("/login");
  return new URL(page.url()).origin;
}

test.describe("an expired session", () => {
  test("renews itself without the admin noticing", async ({ page, context }) => {
    // The realistic shape of an expired session: the access cookie's max-age
    // matched its token's, so the browser has already dropped it, and only the
    // refresh cookie is left. Nothing should be visible but the inbox.
    await signIn(page);
    // Wait for the sign-in to land before reading the jar, or the cookies are
    // read before the action that sets them has finished.
    await expect(page).toHaveURL(/\/admin$/);

    const before = await sessionCookies(context);
    const refresh = before.find((cookie) => cookie.name === "pf_refresh");
    expect(refresh).toBeDefined();

    await context.clearCookies();
    // Re-added with the domain and path it already had, rather than with a
    // `url` built from the config — addCookies rejects a descriptor carrying
    // both, and the cookie's own fields are the ones known to match the host.
    await context.addCookies([
      {
        name: refresh!.name,
        value: refresh!.value,
        domain: refresh!.domain,
        path: refresh!.path,
        httpOnly: true,
        secure: refresh!.secure,
        sameSite: refresh!.sameSite,
      },
    ]);
    expect(await sessionCookies(context)).toHaveLength(1);

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Contact messages" })).toBeVisible();

    // A fresh access cookie, minted by the refresh route on the way through.
    const after = await sessionCookies(context);
    expect(after.map((cookie) => cookie.name).sort()).toEqual(["pf_access", "pf_refresh"]);
  });

  test("a refresh token the API rejects ends the session instead of looping", async ({
    page,
    context,
  }) => {
    // A redirect loop is the obvious way to get this wrong: the guard sends the
    // caller to the refresh route, which fails, which sends them back.
    await context.addCookies([
      { name: "pf_refresh", value: "not-a-real-token", url: await liveOrigin(page), httpOnly: true },
    ]);
    // Proves the cookie is actually being sent. Without this the test passes
    // just as happily against no cookie at all, which is a different path.
    expect(await sessionCookies(context)).toHaveLength(1);

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login/);
    expect(await sessionCookies(context)).toHaveLength(0);
  });
});

test.describe("signing out", () => {
  test("clears the session and closes the door again", async ({ page, context }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(await sessionCookies(context)).toHaveLength(0);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });
});
