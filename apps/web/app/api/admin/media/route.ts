import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-guard";
import { fetchMedia } from "@/lib/console-api";

/**
 * The library, for the gallery picker in the browser.
 *
 * ## Why a route and not a Server Action
 *
 * Actions are for writes. This is a read that happens when a disclosure opens,
 * it takes a query string, and it wants to be cacheable-shaped and cancellable
 * by the caller — all of which a `fetch` to a route does plainly and an action
 * invoked as a POST does awkwardly.
 *
 * ## Why `getAdminSession` and not `requireAdmin`
 *
 * Same reason as the upload route: `requireAdmin` answers a failed check with a
 * redirect, `fetch` follows redirects, and the caller would receive the sign-in
 * *page* with a 200 on it and fail parsing HTML as JSON. Returning null lets
 * this answer 401, which the picker can report as something the admin can act
 * on.
 *
 * The API is the real gate — every route under /media is admin-only there, and
 * the token below is what proves it. This check exists so the failure is a
 * clean 401 rather than a round trip that dies on the API's side.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  const result = await fetchMedia(session.accessToken, { q, limit: 200 });

  if (!result.ok) {
    const status = result.reason === "unauthorized" ? 401 : 502;
    return NextResponse.json({ error: "The library could not be read" }, { status });
  }

  return NextResponse.json(result.data);
}
