import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCareerEntries,
  getCertificates,
  getProject,
  getProjects,
  getSkills,
} from "./api";

/**
 * The promise this file exists to keep.
 *
 * `apps/web` replaced a static site that could not break, so every read has to
 * degrade to a fallback rather than take the page down with it. The CI web job
 * builds with no API running for the same reason — but a build that succeeds
 * only proves nothing threw, not that a dead backend, a 500, a timeout and a
 * body that is not JSON all land on the same safe answer. Those four are the
 * ones tested here; what a visitor then sees is tested in tests/e2e.
 */

const OK = { status: 200, headers: { "content-type": "application/json" } };

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { ...OK, ...init });
}

/** Every list reader, so a new one added without a fallback is caught here. */
const LIST_READERS = [
  ["getProjects", getProjects],
  ["getSkills", getSkills],
  ["getCertificates", getCertificates],
  ["getCareerEntries", getCareerEntries],
] as const;

let fetchMock: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Failures are meant to be logged, not swallowed. Spying keeps the test
  // output readable and lets the logging itself be asserted.
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("when the API is unreachable", () => {
  it.each(LIST_READERS)("%s returns an empty list", async (_name, read) => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: new Error("ECONNREFUSED") }),
    );

    await expect(read()).resolves.toEqual([]);
  });

  it("getProject returns null", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(getProject("portfolio")).resolves.toBeNull();
  });

  it("says so on the server log", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await getProjects();

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects/"),
      expect.anything(),
    );
  });
});

describe("when the API hangs", () => {
  it("gives up rather than holding the render open", async () => {
    // What AbortSignal.timeout(5000) produces once it fires. The page must
    // render without the data; a request with no ceiling would mean a hung
    // backend hanging every visitor's first paint.
    fetchMock.mockRejectedValue(new DOMException("The operation timed out", "TimeoutError"));

    await expect(getSkills()).resolves.toEqual([]);
  });

  it("asks for a timeout at all", async () => {
    fetchMock.mockResolvedValue(json([]));

    await getSkills();

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });
});

describe("when the API answers with an error", () => {
  it.each([500, 502, 503, 401, 400])("%i falls back", async (status) => {
    fetchMock.mockResolvedValue(json({ detail: "boom" }, { status }));

    await expect(getCertificates()).resolves.toEqual([]);
    expect(errorLog).toHaveBeenCalled();
  });

  it("treats a 404 on a detail route as no project", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Not found" }, { status: 404 }));

    await expect(getProject("nope")).resolves.toBeNull();
  });
});

describe("when the body is not what it claims", () => {
  it("falls back on a body that is not JSON at all", async () => {
    // The realistic shape of this is a proxy or a suspended free-tier host
    // returning an HTML error page with a 200 on it.
    fetchMock.mockResolvedValue(new Response("<html>Service suspended</html>", OK));

    await expect(getProjects()).resolves.toEqual([]);
  });

  it("falls back on an empty body", async () => {
    fetchMock.mockResolvedValue(new Response("", OK));

    await expect(getProjects()).resolves.toEqual([]);
  });

  it.each(LIST_READERS)(
    "%s falls back when the route answers 200 with something that is not a list",
    async (_name, read) => {
      // Every caller does `.length` and `.map`. An object satisfies the type
      // only because the cast in getJson says so, and the page then throws at
      // render — a 500 produced by a *successful* request, which is the one
      // outcome this module exists to prevent.
      fetchMock.mockResolvedValue(json({ detail: "Unauthorized" }));

      await expect(read()).resolves.toEqual([]);
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining("unexpected shape"),
        expect.anything(),
      );
    },
  );

  it("getProject falls back when a detail route answers with a list", async () => {
    fetchMock.mockResolvedValue(json([{ id: 1 }]));

    await expect(getProject("portfolio")).resolves.toBeNull();
  });

  it("getProject falls back when a detail route answers with a bare string", async () => {
    fetchMock.mockResolvedValue(json("Service Unavailable"));

    await expect(getProject("portfolio")).resolves.toBeNull();
  });
});

describe("when the API works", () => {
  it("returns the payload", async () => {
    const projects = [{ id: 1, slug: "portfolio", title: "Portfolio" }];
    fetchMock.mockResolvedValue(json(projects));

    await expect(getProjects()).resolves.toEqual(projects);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("returns the project a detail route sends", async () => {
    fetchMock.mockResolvedValue(json({ id: 1, slug: "portfolio" }));

    await expect(getProject("portfolio")).resolves.toMatchObject({ slug: "portfolio" });
  });
});

describe("the request it makes", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(json([]));
  });

  it("hits the versioned path on API_URL", async () => {
    await getCareerEntries();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/career/",
      expect.anything(),
    );
  });

  it("asks for JSON and lets Next cache it", async () => {
    await getSkills();

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
  });

  it("encodes a slug so it cannot escape its path segment", async () => {
    fetchMock.mockResolvedValue(json(null));

    await getProject("../../admin/contacts");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8000/api/v1/projects/slug/..%2F..%2Fadmin%2Fcontacts",
    );
  });
});

describe("API_URL", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("is read from the environment", async () => {
    // Read at module scope, so the module has to be re-imported for a change
    // to it to be visible.
    vi.stubEnv("API_URL", "https://api.example.com");
    vi.resetModules();

    const { getProjects: reread } = await import("./api");
    fetchMock.mockResolvedValue(json([]));

    await reread();

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/v1/projects/");
  });
});
