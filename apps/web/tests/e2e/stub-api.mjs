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

/** A post whose body is real Markdown, so the render pipeline is exercised too. */
function post(slug) {
  return {
    id: 1,
    slug,
    title: "Stubbed Post",
    excerpt: "A post served by the e2e stub.",
    body: "## Stubbed heading\n\nA paragraph with `code` in it.\n",
    tags: ["FastAPI", "Next.js"],
    cover_image: null,
    published: true,
    published_at: "2026-08-09T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: null,
  };
}

/**
 * Tokens shaped like the real ones, so the console's own parsing is exercised.
 *
 * The signature is a fixed string and nothing here verifies it — that is the
 * API's job, and this stub stands in for the API. What matters is that the
 * payload is a real base64url JSON object with a real `exp`, because the
 * console decodes it to show when the session ends, and a spec needs to be able
 * to hand it an expired one.
 */
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function makeToken({ type, role = "admin", secondsFromNow }) {
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: "1", type, role, exp })}.stub-signature`;
}

function readToken(value) {
  try {
    const payload = JSON.parse(Buffer.from(String(value).split(".")[1], "base64url").toString());
    // An expired token is refused here rather than accepted, because that is
    // the whole point of the renewal path the console has to walk.
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearer(request) {
  const header = request.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? readToken(header.slice(7)) : null;
}

function tokenPair(role = "admin") {
  return {
    access_token: makeToken({ type: "access", role, secondsFromNow: 3600 }),
    refresh_token: makeToken({ type: "refresh", role, secondsFromNow: 30 * 24 * 3600 }),
    token_type: "bearer",
    expires_in: 3600,
    user_id: 1,
    email: role === "admin" ? "admin@example.com" : "viewer@example.com",
  };
}

/** The password the stub accepts. Anything else is a 401, as the API does. */
const GOOD_PASSWORD = "correct-horse-battery-staple";

function contact(id, overrides = {}) {
  return {
    id,
    name: "Ada Lovelace",
    email: "ada@example.com",
    subject: `Stubbed message ${id}`,
    message: "The analytical engine weaves algebraic patterns.",
    read: false,
    created_at: "2026-08-09T10:30:00Z",
    updated_at: null,
    ...overrides,
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

  if (request.method === "POST" && pathname === "/api/v1/auth/login") {
    const body = await readBody(request);
    received.push({ body: { email: body.email }, forwardedFor: request.headers["x-forwarded-for"] ?? null });

    const email = String(body.email ?? "");

    if (email.includes("stub:429")) {
      // 900s = 15 minutes, which the form should render as "about 15 minutes".
      return send(response, 429, { error: "Rate limit exceeded" }, { "retry-after": "900" });
    }
    if (email.includes("stub:503")) {
      return send(response, 503, { detail: "Service unavailable" });
    }
    if (email.includes("stub:hangup")) {
      return hangUp(response);
    }

    if (body.password !== GOOD_PASSWORD) {
      // One answer for every kind of bad credential, exactly as the API does,
      // so the screen cannot be used to find out which addresses exist.
      return send(response, 401, { detail: "Invalid email or password" });
    }

    // A signed-in account that is not an admin — enough to hold a session and
    // still be refused the inbox.
    return send(response, 200, tokenPair(email.includes("stub:viewer") ? "viewer" : "admin"));
  }

  if (request.method === "POST" && pathname === "/api/v1/auth/password-reset-request") {
    const body = await readBody(request);
    received.push({
      body: { email: body.email },
      forwardedFor: request.headers["x-forwarded-for"] ?? null,
    });

    const email = String(body.email ?? "");

    if (email.includes("stub:429")) {
      // 3600s = an hour, matching the API's 5/hour cap on this route.
      return send(response, 429, { detail: "Too many requests" }, { "retry-after": "3600" });
    }
    if (email.includes("stub:503")) {
      return send(response, 503, { detail: "Service unavailable" });
    }
    if (email.includes("stub:hangup")) {
      return hangUp(response);
    }

    // Everything else is a 200, including addresses that do not exist — which
    // is the API's actual behaviour and the property the screen is built
    // around. There is deliberately no "unknown address" branch to add.
    return send(response, 200, { message: "Password reset email sent" });
  }

  if (request.method === "POST" && pathname === "/api/v1/auth/password-reset-confirm") {
    const body = await readBody(request);
    const token = String(body.token ?? "");
    const password = String(body.new_password ?? "");

    // The API's own guard, and the only 422 with a *list* detail — which is how
    // lib/console-api.ts tells a rejected password from a rejected token.
    if (password.length < 12) {
      return send(response, 422, {
        detail: [{ loc: ["body", "new_password"], msg: "String should have at least 12 characters" }],
      });
    }

    // A token the API will not accept: expired, already spent, or never real.
    // The API answers all three identically, so the stub does too. `detail` is
    // a string here, which is the API's ValidationError shape.
    if (!readToken(token) || token.includes("stub-dead")) {
      return send(response, 422, { detail: "Invalid or expired reset token" });
    }

    if (password.includes("stub:503")) {
      return send(response, 503, { detail: "Service unavailable" });
    }

    return send(response, 200, { message: "Password reset successfully" });
  }

  if (request.method === "POST" && pathname === "/api/v1/auth/refresh") {
    const body = await readBody(request);
    const payload = readToken(body.refresh_token);

    if (!payload || payload.type !== "refresh") {
      return send(response, 401, { detail: "Invalid refresh token" });
    }
    return send(response, 200, tokenPair(payload.role));
  }

  if (request.method === "POST" && pathname === "/api/v1/auth/logout") {
    return send(response, 200, { message: "Logged out successfully" });
  }

  if (pathname === "/api/v1/auth/me") {
    const payload = bearer(request);
    if (!payload || payload.type !== "access") {
      return send(response, 401, { detail: "Could not validate credentials" });
    }
    return send(response, 200, {
      id: 1,
      email: payload.role === "admin" ? "admin@example.com" : "viewer@example.com",
      username: "admin",
      full_name: "Stub Admin",
      avatar_url: null,
      is_active: true,
      is_verified: true,
      status: "active",
      roles: [payload.role],
      created_at: "2026-01-01T00:00:00Z",
      last_login_at: null,
    });
  }

  if (request.method === "GET" && pathname === "/api/v1/contacts/") {
    const payload = bearer(request);
    if (!payload || payload.type !== "access") {
      return send(response, 401, { detail: "Could not validate credentials" });
    }
    // What require_admin answers a valid token that is not an admin's.
    if (payload.role !== "admin") {
      return send(response, 403, { detail: "Forbidden" });
    }
    return send(response, 200, [contact(1), contact(2, { read: true })]);
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

  // The same five failures as the project route above. A post detail page has
  // one thing a project page does not — it renders Markdown into the DOM — so
  // "the API answered, but not with a post" has to land on the 404 page rather
  // than reaching the renderer with something that is not a post.
  if (pathname.startsWith("/api/v1/posts/slug/")) {
    const slug = decodeURIComponent(pathname.slice("/api/v1/posts/slug/".length));

    if (slug === "stub-500") return send(response, 500, { detail: "Internal error" });
    if (slug === "stub-missing") return send(response, 404, { detail: "Not found" });
    if (slug === "stub-hangup") return hangUp(response);
    if (slug === "stub-not-json") {
      response.writeHead(200, { "content-type": "application/json" });
      return response.end("<html>Service suspended</html>");
    }
    if (slug === "stub-wrong-shape") return send(response, 200, []);

    return send(response, 200, post(slug));
  }

  // The list routes are only reached during the e2e build, which deliberately
  // runs against a closed port — so nothing here should ask for them.
  return send(response, 404, { detail: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[stub-api] listening on http://127.0.0.1:${PORT}`);
});
