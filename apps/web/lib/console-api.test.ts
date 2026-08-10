import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchContacts, fetchCurrentUser, login, logout, refreshSession } from "./console-api";

/**
 * The console's half of the fetch contract, which is the opposite of
 * lib/api.ts's.
 *
 * The public reader turns every failure into a fallback so a sleeping backend
 * cannot take the portfolio down. These calls must not do that: an expired
 * session that came back as an empty list would render as "nobody has written
 * to you" and read as working. What is asserted here is that each failure keeps
 * its identity — unauthorized, rate_limited and error resolve to three
 * different things in the UI.
 */

const OK = { status: 200, headers: { "content-type": "application/json" } };

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { ...OK, ...init });
}

const TOKENS = {
  access_token: "a",
  refresh_token: "r",
  token_type: "bearer",
  expires_in: 3600,
  user_id: 1,
  email: "admin@example.com",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("login", () => {
  it("returns the token pair on 200", async () => {
    fetchMock.mockResolvedValue(json(TOKENS));

    const result = await login("admin@example.com", "correct-horse-battery");

    expect(result).toEqual({ ok: true, data: TOKENS });
  });

  it("reports a 401 as unauthorized, not as an outage", async () => {
    // The difference the sign-in screen turns into "that email and password
    // don't match" rather than "the API is unreachable" — telling someone their
    // password is wrong when the server is down wastes a lot of their time.
    fetchMock.mockResolvedValue(json({ detail: "Invalid email or password" }, { status: 401 }));

    expect(await login("a@b.com", "x")).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("keeps the response on a 429 so Retry-After survives", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Rate limit exceeded" }, { status: 429, headers: { "retry-after": "900" } }),
    );

    const result = await login("a@b.com", "x");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "rate_limited") throw new Error("expected rate_limited");
    expect(result.response.headers.get("retry-after")).toBe("900");
  });

  it.each([
    ["a 500", () => fetchMock.mockResolvedValue(json({}, { status: 500 }))],
    ["an unreachable API", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    [
      "a body that is not JSON",
      () => fetchMock.mockResolvedValue(new Response("<html>gateway</html>", OK)),
    ],
  ])("reports %s as error", async (_label, arrange) => {
    arrange();
    expect(await login("a@b.com", "x")).toEqual({ ok: false, reason: "error" });
  });

  it("forwards the caller's address so the API limits the right person", async () => {
    // Without this the API sees the Next server for every sign-in on earth, and
    // ten attempts total lock the console for everybody.
    fetchMock.mockResolvedValue(json(TOKENS));

    await login("a@b.com", "x", "203.0.113.7");

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Forwarded-For"]).toBe("203.0.113.7");
  });

  it("omits the header entirely when there is no address to forward", async () => {
    fetchMock.mockResolvedValue(json(TOKENS));

    await login("a@b.com", "x");

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect("X-Forwarded-For" in headers).toBe(false);
  });
});

describe("authenticated reads", () => {
  it("sends the token as a bearer credential", async () => {
    fetchMock.mockResolvedValue(json({ id: 1, email: "a@b.com", full_name: null, roles: ["admin"] }));

    await fetchCurrentUser("the-access-token");

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer the-access-token");
  });

  it("never lets a console read be cached", async () => {
    // A response that depends on an Authorization header must not be shared.
    fetchMock.mockResolvedValue(json([]));

    await fetchContacts("token");

    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });

  it("treats a 403 the same as a 401", async () => {
    // require_admin answers 403 to a valid token belonging to a non-admin. From
    // the console's side both mean "this session cannot do this".
    fetchMock.mockResolvedValue(json({ detail: "Forbidden" }, { status: 403 }));

    expect(await fetchContacts("token")).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("refuses a 200 whose body is not a list", async () => {
    // Same failure lib/api.ts guards: a gateway or tunnel answering 200 with
    // its own JSON hands .map() something that is not an array, which is a 500
    // caused by a successful request.
    fetchMock.mockResolvedValue(json({ detail: "not a list" }));

    expect(await fetchContacts("token")).toEqual({ ok: false, reason: "error" });
  });

  it("passes a real list through", async () => {
    const contacts = [
      {
        id: 1,
        name: "A",
        email: "a@b.com",
        subject: "Hi",
        message: "Hello",
        read: false,
        created_at: "2026-08-10T12:00:00Z",
        updated_at: null,
      },
    ];
    fetchMock.mockResolvedValue(json(contacts));

    expect(await fetchContacts("token")).toEqual({ ok: true, data: contacts });
  });
});

describe("refreshSession", () => {
  it("sends the refresh token in the body the API expects", async () => {
    fetchMock.mockResolvedValue(json(TOKENS));

    await refreshSession("the-refresh-token");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      refresh_token: "the-refresh-token",
    });
  });

  it("reports a revoked token as unauthorized so the session is torn down", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Invalid refresh token" }, { status: 401 }));

    expect(await refreshSession("stale")).toEqual({ ok: false, reason: "unauthorized" });
  });
});

describe("logout", () => {
  it("asks the API to revoke both tokens", async () => {
    // The point of signing out. Clearing cookies alone would leave a token that
    // still authenticates for anyone holding it.
    fetchMock.mockResolvedValue(json({ message: "Logged out successfully" }));

    await logout("access", "refresh");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      access_token: "access",
      refresh_token: "refresh",
    });
  });

  it("does not throw when the API is unreachable", async () => {
    // A failure here must not strand someone in a session they asked to leave —
    // the caller clears the cookies either way.
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(logout("access", "refresh")).resolves.toBeUndefined();
  });
});
