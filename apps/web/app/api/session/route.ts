import { NextResponse } from "next/server";

import { readViewer } from "@/lib/viewer-server";

/**
 * Who is signed in, for the chrome in the browser.
 *
 * ## Why a route and not a Server Action
 *
 * Every export of a `"use server"` module is published as a callable endpoint,
 * and app/actions/auth.ts says in so many words that the session-identity
 * lookup deliberately does not live there. That note still holds: this is a
 * read, it is a GET, and it is the shape a route handler is for.
 *
 * ## Why the browser asks at all
 *
 * Because the answer cannot be rendered. Reading a cookie during render opts
 * the whole route out of static rendering, and every page on this site is
 * prerendered — the header alone would take the entire public site dynamic to
 * answer a question that is "nobody" for most visitors. So the pages are static
 * and the chrome fills in a moment later. See lib/viewer-server.ts, and
 * components/blog/rating.tsx, which fetches itself for the same reason.
 *
 * ## What it will not return
 *
 * The token. `Viewer` has no field for one — see lib/viewer.ts — so this cannot
 * hand the browser a credential even by accident, and the httpOnly cookie stays
 * out of reach of any script on the page.
 *
 * ## Why `null` is a 200
 *
 * Because "nobody is signed in" is not an error, it is the answer. A 401 here
 * would put a red line in every visitor's devtools console on every page load
 * and would make the caller treat the ordinary case as a failure.
 */
export async function GET(): Promise<NextResponse> {
  const viewer = await readViewer();

  return NextResponse.json(
    { viewer },
    {
      headers: {
        // Never cached, anywhere. This response is one person's identity, and a
        // shared cache holding it is the whole failure mode.
        "Cache-Control": "no-store, private",
      },
    },
  );
}
