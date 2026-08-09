import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a real production build in a real browser.
 *
 * These cover the two things a unit test cannot reach: what a visitor sees when
 * the API is not there, and what the contact form does with a 429 — states that
 * only exist once a Server Action, a client component and a status code are all
 * in play at once.
 *
 * The build is produced by tests/e2e/build-fixture.mjs before Playwright starts
 * (see the `test:e2e` script), with no API reachable. It is not built here,
 * because the build and the server need different values of `API_URL` and a
 * `webServer` entry gets one environment.
 */

/**
 * Not 3000 and 8000, which are occupied on the machine this is developed on —
 * along with 3005-3011, 3042, 8010, 8011 and 8042, so the defaults below are
 * chosen to be out of the way rather than conventional.
 *
 * The hazard is specific: a port that is already taken does not announce
 * itself. An unrelated server answers, the suite passes or fails against
 * software that is not this app, and the result means nothing. Hence
 * `reuseExistingServer: false` on both entries below, which turns that into an
 * immediate "address already in use" — and hence both being overridable when
 * these two get taken as well.
 */
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3142);
const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 8142);

export const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
export const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // `.test.ts` belongs to Vitest; only `.spec.ts` is Playwright's.
  testMatch: /.*\.spec\.ts/,

  // A test that only passes on a retry is a flaky test, and this suite has no
  // timing-dependent assertions in it. CI retries once because a cold runner
  // can miss a first paint; locally a failure should just be a failure.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,

  /**
   * On CI: `github` annotates the failing line in the diff, and `html` produces
   * the report the workflow uploads on failure — which is where the trace and
   * the screenshot from a retry actually become readable. Locally `list` is
   * enough; an HTML report nobody opens is just a directory to gitignore.
   */
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  /**
   * Chromium alone. The suite asserts behaviour — status codes, copy, focus —
   * not rendering, and none of it is engine-specific; adding WebKit and Firefox
   * would triple both the CI browser download and the run for no new signal.
   * The cross-browser question worth asking about this site is visual, and a
   * screenshot review answers it better than a headless assertion would.
   */
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      command: `node tests/e2e/stub-api.mjs`,
      url: `${STUB_URL}/__health`,
      env: { E2E_STUB_PORT: String(STUB_PORT) },
      // If something is already on this port, fail rather than test whatever it
      // happens to be.
      reuseExistingServer: false,
      stdout: "pipe",
    },
    {
      command: `pnpm exec next start --port ${WEB_PORT}`,
      url: BASE_URL,
      env: {
        // Deliberately not the port the build ran against — see the header of
        // build-fixture.mjs. The prerendered pages keep the fallbacks they were
        // built with; anything rendered per request reaches the stub.
        API_URL: STUB_URL,
      },
      reuseExistingServer: false,
      stdout: "pipe",
      timeout: 60_000,
    },
  ],
});
