import { spawn } from "node:child_process";
import { connect } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Builds the app the e2e suite runs against, with no API reachable.
 *
 * ## Why the build is where the outage is simulated
 *
 * Every page in this app is prerendered — `next build` prints them as ○ Static
 * with a 5-minute revalidate. So the moment lib/api.ts decides between real
 * content and its fallback is *build* time, not request time, and pointing a
 * running server at a dead API would prove nothing: it would serve HTML that
 * was rendered while the API was up.
 *
 * Building against a closed port is therefore the real test of the promise in
 * CLAUDE.md — the site renders when the backend is not there. It is also what
 * the CI web job already does; the difference is that CI only learns the build
 * did not throw, while the specs then open the pages and read them.
 *
 * The server started afterwards by playwright.config.ts points at the stub
 * instead. That is not a contradiction: `process.env.API_URL` survives into the
 * server bundle rather than being inlined at build time, so the prerendered
 * pages keep their fallbacks while the Server Action behind the contact form —
 * which runs per request — talks to the stub. One build, both states.
 */

const require = createRequire(import.meta.url);
const webRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Ports that are open when they should not be are a recurring trap on this
 * machine: a server left over from an earlier session keeps answering, so the
 * build quietly succeeds against stale content and the suite tests nothing.
 * Every candidate is probed rather than assumed.
 */
const CANDIDATE_DEAD_PORTS = [8043, 8044, 8045, 9042, 9043];

function isClosed(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    const settle = (closed) => {
      socket.destroy();
      resolve(closed);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => settle(false));
    socket.once("timeout", () => settle(false));
    // ECONNREFUSED: nothing is listening, which is exactly what is wanted.
    socket.once("error", () => settle(true));
  });
}

async function findClosedPort() {
  for (const port of CANDIDATE_DEAD_PORTS) {
    if (await isClosed(port)) return port;
    console.warn(`[e2e] port ${port} has something listening on it; trying the next one`);
  }

  throw new Error(
    `No closed port among ${CANDIDATE_DEAD_PORTS.join(", ")}. The build needs one that ` +
      `refuses connections so the fallback path is the one exercised.`,
  );
}

const deadPort = await findClosedPort();
const apiUrl = `http://127.0.0.1:${deadPort}`;

console.log(`[e2e] building against ${apiUrl} — nothing is listening there, which is the point`);

// Spawned through Node with the resolved bin rather than a bare `next`, so this
// does not depend on the shell or on PATH — the two differ between the Windows
// machine this is developed on and the Linux runner in CI.
const nextBin = require.resolve("next/dist/bin/next");

const build = spawn(process.execPath, [nextBin, "build"], {
  cwd: webRoot,
  stdio: "inherit",
  env: { ...process.env, API_URL: apiUrl },
});

build.on("exit", (code) => {
  if (code !== 0) {
    console.error(
      "\n[e2e] the build failed with no API running. That is the failure this suite exists " +
        "to catch: a read in lib/api.ts is no longer falling back.",
    );
  }
  process.exit(code ?? 1);
});
