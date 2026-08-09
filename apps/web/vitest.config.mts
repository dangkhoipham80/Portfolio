import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests for the modules that are plain functions.
 *
 * The split with Playwright is deliberate and worth stating, because the
 * tempting middle layer — jsdom plus a React testing library — is the one thing
 * not used here. Anything that renders is tested in a real browser against a
 * real production build (see playwright.config.ts); anything that does not is
 * tested here, in Node, in milliseconds. A jsdom test of ContactForm would need
 * a faked DOM, a faked `useActionState` and a stubbed Server Action, and would
 * still not answer the only interesting question about that component, which is
 * what a person sees after the API returns 429.
 *
 * So this project runs no component tests. That is a choice, not an omission.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path in tsconfig.json. Vitest does not read
      // tsconfig paths on its own, and without this the imports under test
      // resolve here differently than they do in the app.
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
    /**
     * `lib/api.ts` starts with `import "server-only"`, whose export map sends
     * every condition except `react-server` to a module that throws on import.
     * That is the guard doing its job — but it makes the file untestable unless
     * the runner asks for the same condition the RSC bundler does.
     *
     * Aliasing `server-only` to an empty file is the usual workaround and is
     * worse: it switches the guard off for every module, including one added
     * later that genuinely must not be reachable from a client component. This
     * satisfies the export map rather than bypassing it.
     */
    conditions: ["react-server", "node", "import", "default"],
  },
  /**
   * And again for the SSR pipeline, which is the one Vitest's `node`
   * environment actually runs through. `resolve.conditions` alone is the
   * client-side list and leaves this import resolving to the throwing file.
   */
  ssr: {
    resolve: {
      conditions: ["react-server", "node", "import", "default"],
    },
  },
  test: {
    // No DOM on purpose — see the note above.
    environment: "node",
    server: {
      deps: {
        /**
         * `resolve.conditions` only reaches modules Vite itself resolves.
         * Anything in node_modules is externalised by default and imported by
         * Node, which has never heard of `react-server` — so without this the
         * condition above is quietly ignored and the import throws.
         */
        inline: ["server-only"],
      },
    },
    /**
     * `.test.ts` is Vitest, `.spec.ts` is Playwright. Without the split Vitest
     * collects the e2e specs, imports `@playwright/test` outside a Playwright
     * runner and fails with an error that has nothing to do with the code.
     */
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
