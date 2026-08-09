import { createServer } from "node:http";

/**
 * A stand-in for apps/api, so the e2e suite never touches a real backend.
 *
 * Pointing the tests at the actual API would make them depend on a database, on
 * whatever rows happen to be in it, and — for the rate-limit case — on burning
 * four real submissions to reach the fifth. Worse, the interesting states are
 * the ones a healthy API will not produce on demand: 429, 5xx, a connection
 * that drops mid-request.
 *
 * There is no mode switch and no shared state, so the specs can run in any
 * order and in parallel. Instead each response is decided by what the request
 * carries: a contact's `subject`, or a project's slug. The Server Action under
 * test cannot tell the difference — it branches on the status code, and the
 * status code is real.
 */

const PORT = Number(process.env.E2E_STUB_PORT ?? 8142);

/** Every contact POST that arrived, so a spec can assert what was forwarded. */
const received = [];

/** Complete enough to render the detail page; the values are recognisable on purpose. */
function project(slug) {
  return {
    id: 1,
    slug,
    title: "Stubbed Project",
    description: "A project served by the e2e stub.",
    long_description: "The long description, which the detail page renders.",
    image_url: null,
    github_url: "https://github.com/dangkhoipham80/portfolio",
    live_url: null,
    technologies: ["FastAPI", "Next.js"],
    features: ["A feature"],
    challenges: ["A challenge"],
    started_on: "2025-01-01",
    ended_on: null,
    status: "in_progress",
    featured: true,
    published: true,
    order: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: null,
  };
}

function send(response, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  });
  response.end(payload);
}

/**
 * Drop the connection without answering.
 *
 * This is what a backend that has fallen over looks like from the Next server:
 * `fetch` rejects, and the catch block in lib/api.ts — or in the Server Action —
 * is the thing under test. Refusing to listen at all would test the same path,
 * but then this server could not also serve the tests that need it up.
 */
function hangUp(response) {
  response.socket?.destroy();
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://127.0.0.1:${PORT}`);

  // Readiness for Playwright's webServer, and a way to prove in a failing run
  // that the thing answering is this stub and not a leftover from an earlier
  // session sitting on the same port.
  if (pathname === "/__health") {
    return send(response, 200, { stub: "portfolio-e2e" });
  }

  if (pathname === "/__requests") {
    return send(response, 200, received);
  }

  if (request.method === "POST" && pathname === "/api/v1/contacts/") {
    const body = await readBody(request);
    received.push({ body, forwardedFor: request.headers["x-forwarded-for"] ?? null });

    const subject = String(body.subject ?? "");

    // Ordered longest-key-first: "stub:429-bare" also contains "stub:429".
    if (subject.includes("stub:429-bare")) {
      return send(response, 429, { detail: "Too many requests" });
    }
    if (subject.includes("stub:429")) {
      // 2700s = 45 minutes, which the form should render as "about 45 minutes"
      // rather than a raw number of seconds.
      return send(response, 429, { detail: "Too many requests" }, { "retry-after": "2700" });
    }
    if (subject.includes("stub:503")) {
      return send(response, 503, { detail: "Service unavailable" });
    }
    if (subject.includes("stub:hangup")) {
      return hangUp(response);
    }
    if (subject.includes("stub:422")) {
      // The shape FastAPI sends when EmailStr rejects an address that the
      // browser-side regex let through.
      return send(response, 422, {
        detail: [{ loc: ["body", "email"], msg: "value is not a valid email address" }],
      });
    }

    return send(response, 201, { id: 1, ...body, read: false, created_at: "2026-08-09T00:00:00Z" });
  }

  if (pathname.startsWith("/api/v1/projects/slug/")) {
    const slug = decodeURIComponent(pathname.slice("/api/v1/projects/slug/".length));

    if (slug === "stub-500") return send(response, 500, { detail: "Internal error" });
    if (slug === "stub-missing") return send(response, 404, { detail: "Not found" });
    if (slug === "stub-hangup") return hangUp(response);
    if (slug === "stub-not-json") {
      response.writeHead(200, { "content-type": "application/json" });
      return response.end("<html>Service suspended</html>");
    }
    // A detail route answering with a list: valid JSON, 200, wrong shape.
    if (slug === "stub-wrong-shape") return send(response, 200, []);

    return send(response, 200, project(slug));
  }

  // The list routes are only reached during the e2e build, which deliberately
  // runs against a closed port — so nothing here should ask for them.
  return send(response, 404, { detail: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[stub-api] listening on http://127.0.0.1:${PORT}`);
});
